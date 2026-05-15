import { describe, it, expect } from 'vitest'
import { reassignAssignmentSchema } from '@/lib/validations'

describe('reassignAssignmentSchema', () => {
  const validBase = {
    userIds: ['11111111-1111-4111-8111-111111111111'],
    newDueDate: '2026-12-31T23:59:59Z',
    reason: 'failed' as const,
    additionalAttempts: 3,
  }

  it('geçerli payload kabul eder', () => {
    expect(reassignAssignmentSchema.safeParse(validBase).success).toBe(true)
  })

  it('boş userIds reddeder', () => {
    expect(reassignAssignmentSchema.safeParse({ ...validBase, userIds: [] }).success).toBe(false)
  })

  it('UUID olmayan userId reddeder', () => {
    expect(reassignAssignmentSchema.safeParse({ ...validBase, userIds: ['not-a-uuid'] }).success).toBe(false)
  })

  it('5001+ userIds reddeder (DoS koruması)', () => {
    const big = Array.from({ length: 5001 }, () => '11111111-1111-4111-8111-111111111111')
    expect(reassignAssignmentSchema.safeParse({ ...validBase, userIds: big }).success).toBe(false)
  })

  it('geçersiz reason enum reddeder', () => {
    expect(
      reassignAssignmentSchema.safeParse({ ...validBase, reason: 'invalid' as unknown as 'failed' }).success,
    ).toBe(false)
  })

  it('3 segment reason değerini kabul eder', () => {
    for (const r of ['failed', 'no_show', 'overdue_in_progress'] as const) {
      expect(reassignAssignmentSchema.safeParse({ ...validBase, reason: r }).success).toBe(true)
    }
  })

  it('additionalAttempts default 3', () => {
    const parsed = reassignAssignmentSchema.safeParse({
      userIds: validBase.userIds,
      newDueDate: validBase.newDueDate,
      reason: 'failed',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.additionalAttempts).toBe(3)
  })

  it('additionalAttempts > 10 reddeder', () => {
    expect(reassignAssignmentSchema.safeParse({ ...validBase, additionalAttempts: 11 }).success).toBe(false)
  })

  it('ISO olmayan tarih reddeder', () => {
    expect(reassignAssignmentSchema.safeParse({ ...validBase, newDueDate: 'not-a-date' }).success).toBe(false)
  })
})
