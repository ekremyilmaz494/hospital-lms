import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getEffectiveStartDate,
  defaultPeriodBounds,
  periodStatusLabel,
} from '../training-periods'

// Prisma mock
const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('../prisma', () => ({
  prisma: {
    trainingPeriod: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}))

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  mockFindFirst.mockReset()
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockTransaction.mockReset()
})

describe('defaultPeriodBounds', () => {
  it('takvim yılı için 1 Oca – 31 Ara TR sınırlarını döner', () => {
    const { startDate, endDate } = defaultPeriodBounds(2026)
    expect(startDate.getUTCFullYear()).toBe(2025) // 1 Oca 00:00 TR = 31 Ara 21:00 UTC
    expect(endDate.getUTCFullYear()).toBe(2026)
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime())
  })

  it('iki yıl arasındaki sınırlar çakışmaz', () => {
    const a = defaultPeriodBounds(2026)
    const b = defaultPeriodBounds(2027)
    expect(b.startDate.getTime()).toBeGreaterThan(a.endDate.getTime())
  })
})

describe('getEffectiveStartDate', () => {
  const period = { startDate: new Date('2026-01-01T00:00:00Z') }

  it('hireDate yoksa createdAt fallback olur', () => {
    const user = { hireDate: null, createdAt: new Date('2025-06-15T10:00:00Z') }
    // user.createdAt period öncesinde → period.startDate döner
    const result = getEffectiveStartDate(user, period)
    expect(result).toEqual(period.startDate)
  })

  it('hireDate period.startDate öncesinde ise period.startDate döner', () => {
    const user = {
      hireDate: new Date('2025-08-01T00:00:00Z'),
      createdAt: new Date('2025-08-01T00:00:00Z'),
    }
    const result = getEffectiveStartDate(user, period)
    expect(result).toEqual(period.startDate)
  })

  it('hireDate period.startDate sonrasında ise hireDate döner (yıl içi başlayan personel)', () => {
    const user = {
      hireDate: new Date('2026-06-15T09:00:00Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
    }
    const result = getEffectiveStartDate(user, period)
    expect(result).toEqual(user.hireDate)
  })

  it('createdAt period sonrasında ise (hireDate null) createdAt döner', () => {
    const user = {
      hireDate: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
    }
    const result = getEffectiveStartDate(user, period)
    expect(result).toEqual(user.createdAt)
  })
})

describe('periodStatusLabel', () => {
  it('Türkçe etiketleri döner', () => {
    expect(periodStatusLabel('active')).toBe('Aktif')
    expect(periodStatusLabel('upcoming')).toBe('Yaklaşan')
    expect(periodStatusLabel('closed')).toBe('Kapalı')
  })
})

describe('openNewPeriod (idempotency)', () => {
  it('aynı (org, year) varsa onu döner — yeni create etmez', async () => {
    const { openNewPeriod } = await import('../training-periods')
    const existing = { id: 'p1', organizationId: 'org1', year: 2026, status: 'upcoming' }
    mockFindUnique.mockResolvedValueOnce(existing)

    const result = await openNewPeriod('org1', { year: 2026 })

    expect(result).toBe(existing)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('yoksa yeni period oluşturur', async () => {
    const { openNewPeriod } = await import('../training-periods')
    mockFindUnique.mockResolvedValueOnce(null)
    const created = { id: 'p2', organizationId: 'org1', year: 2027, status: 'upcoming' }
    mockCreate.mockResolvedValueOnce(created)

    const result = await openNewPeriod('org1', { year: 2027 })

    expect(result).toBe(created)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('endDate startDate öncesinde ise 400 ApiError fırlatır', async () => {
    const { openNewPeriod } = await import('../training-periods')
    mockFindUnique.mockResolvedValueOnce(null)
    await expect(
      openNewPeriod('org1', {
        year: 2027,
        startDate: new Date('2027-12-01'),
        endDate: new Date('2027-01-01'),
      }),
    ).rejects.toThrow(/bitiş tarihi/i)
  })
})

describe('getActivePeriod', () => {
  it('aktif period yoksa 409 ApiError fırlatır', async () => {
    const { getActivePeriod } = await import('../training-periods')
    mockFindFirst.mockResolvedValueOnce(null)
    await expect(getActivePeriod('org1')).rejects.toThrow(/Aktif eğitim dönemi/)
  })

  it('aktif period varsa onu döner', async () => {
    const { getActivePeriod } = await import('../training-periods')
    const active = { id: 'p1', organizationId: 'org1', year: 2026, status: 'active' }
    mockFindFirst.mockResolvedValueOnce(active)
    const result = await getActivePeriod('org1')
    expect(result).toBe(active)
  })
})
