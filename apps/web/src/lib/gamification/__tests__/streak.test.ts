import { describe, it, expect, vi } from 'vitest'
import { touchStreak, computeAtRisk } from '../streak'

// Istanbul 2026-06-21 (UTC 10:00 → TR 13:00)
const NOW = new Date('2026-06-21T10:00:00Z')
const date = (s: string) => new Date(`${s}T00:00:00.000Z`)

function makeTx(streakRow: unknown) {
  const tx = {
    userStreak: {
      findUnique: vi.fn().mockResolvedValue(streakRow),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  }
  return tx
}

describe('touchStreak', () => {
  it('ilk kez → current=1, longest=1, lastActiveDate=bugün', async () => {
    const tx = makeTx(null)
    await touchStreak(tx as never, 'u1', 'org1', NOW)
    expect(tx.userStreak.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ current: 1, longest: 1, freezesLeft: 2 }) }),
    )
  })

  it('aynı gün ikinci submit → no-op (kredi/seri değişmez)', async () => {
    const tx = makeTx({ current: 3, longest: 5, lastActiveDate: date('2026-06-21'), freezesLeft: 2 })
    await touchStreak(tx as never, 'u1', 'org1', NOW)
    expect(tx.userStreak.update).not.toHaveBeenCalled()
    expect(tx.userStreak.create).not.toHaveBeenCalled()
  })

  it('dünden devam → current+1, longest güncellenir', async () => {
    const tx = makeTx({ current: 5, longest: 5, lastActiveDate: date('2026-06-20'), freezesLeft: 2 })
    await touchStreak(tx as never, 'u1', 'org1', NOW)
    expect(tx.userStreak.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ current: 6, longest: 6 }) }),
    )
  })

  it('boşluk (2+ gün) → current=1, longest korunur', async () => {
    const tx = makeTx({ current: 9, longest: 12, lastActiveDate: date('2026-06-18'), freezesLeft: 0 })
    await touchStreak(tx as never, 'u1', 'org1', NOW)
    expect(tx.userStreak.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ current: 1, longest: 12 }) }),
    )
  })
})

describe('computeAtRisk', () => {
  it('bugün aktifse risk YOK', () => {
    expect(computeAtRisk({ current: 3, longest: 3, lastActiveDate: date('2026-06-21'), freezesLeft: 2 }, NOW)).toBe(false)
  })
  it('bugün aktif değil + seri varsa risk VAR', () => {
    expect(computeAtRisk({ current: 3, longest: 3, lastActiveDate: date('2026-06-20'), freezesLeft: 2 }, NOW)).toBe(true)
  })
  it('seri 0 veya kayıt yoksa risk YOK', () => {
    expect(computeAtRisk({ current: 0, longest: 5, lastActiveDate: date('2026-06-10'), freezesLeft: 0 }, NOW)).toBe(false)
    expect(computeAtRisk(null, NOW)).toBe(false)
  })
})
