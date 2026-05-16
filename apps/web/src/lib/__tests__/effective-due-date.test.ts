import { describe, it, expect } from 'vitest'
import { getEffectiveDueDate } from '@/lib/effective-due-date'

describe('getEffectiveDueDate', () => {
  const trainingEnd = new Date('2026-12-31T23:59:59Z')
  const assignmentDue = new Date('2026-06-15T23:59:59Z')

  it('atama dueDate set ise onu döner (override)', () => {
    expect(getEffectiveDueDate({ dueDate: assignmentDue }, { endDate: trainingEnd })).toEqual(assignmentDue)
  })

  it('atama dueDate null ise training.endDate döner (fallback)', () => {
    expect(getEffectiveDueDate({ dueDate: null }, { endDate: trainingEnd })).toEqual(trainingEnd)
  })

  it('string input kabul eder (Prisma JSON serialization sonrası)', () => {
    const result = getEffectiveDueDate({ dueDate: '2026-06-15T23:59:59Z' }, { endDate: '2026-12-31T23:59:59Z' })
    expect(result.toISOString()).toBe(assignmentDue.toISOString())
  })
})
