import { describe, it, expect, vi } from 'vitest'

// Combined route'un ağır importlarını izole et — sadece pure helper'ı test ediyoruz.
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createBearerClient: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/redis', () => ({ getCached: vi.fn(), setCached: vi.fn() }))
vi.mock('@/lib/training-periods', () => ({ findActivePeriod: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/api-handler', () => ({ withAdminRoute: (fn: unknown) => fn }))

import { complianceAlertStatus } from '../route'

describe('complianceAlertStatus', () => {
  it('süresi geçmiş (daysLeft <= 0) → overdue (eskiden hiç gösterilmiyordu)', () => {
    expect(complianceAlertStatus(0)).toBe('overdue')
    expect(complianceAlertStatus(-5)).toBe('overdue')
  })
  it('1–7 gün → critical', () => {
    expect(complianceAlertStatus(1)).toBe('critical')
    expect(complianceAlertStatus(7)).toBe('critical')
  })
  it('8–30 gün → warning', () => {
    expect(complianceAlertStatus(8)).toBe('warning')
    expect(complianceAlertStatus(30)).toBe('warning')
  })
  it('30+ gün → ok', () => {
    expect(complianceAlertStatus(31)).toBe('ok')
    expect(complianceAlertStatus(365)).toBe('ok')
  })
})
