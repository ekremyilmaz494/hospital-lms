import { describe, it, expect } from 'vitest'
import { UUID_RE, buildStaffOrderBy } from '../_query-helpers'

describe('staff _query-helpers', () => {
  describe('UUID_RE — dönem (periodId) doğrulaması', () => {
    it('geçerli UUID kabul eder', () => {
      expect(UUID_RE.test('11111111-2222-3333-4444-555555555555')).toBe(true)
    })
    it('UUID olmayanı reddeder (örn. __all__, boş, rastgele)', () => {
      expect(UUID_RE.test('__all__')).toBe(false)
      expect(UUID_RE.test('')).toBe(false)
      expect(UUID_RE.test('not-a-uuid')).toBe(false)
      expect(UUID_RE.test('11111111-2222-3333-4444')).toBe(false)
    })
  })

  describe('buildStaffOrderBy — sunucu sıralaması', () => {
    it("name → lastName + firstName (verilen yönde)", () => {
      expect(buildStaffOrderBy('name', 'asc')).toEqual([{ lastName: 'asc' }, { firstName: 'asc' }])
      expect(buildStaffOrderBy('name', 'desc')).toEqual([{ lastName: 'desc' }, { firstName: 'desc' }])
    })
    it('department → ilişki üzerinden departman adı', () => {
      expect(buildStaffOrderBy('department', 'asc')).toEqual({ departmentRel: { name: 'asc' } })
    })
    it('title ve status doğrudan alan', () => {
      expect(buildStaffOrderBy('title', 'desc')).toEqual({ title: 'desc' })
      expect(buildStaffOrderBy('status', 'asc')).toEqual({ isActive: 'asc' })
    })
    it('bilinmeyen/null/hesaplanmış kolon → createdAt desc (varsayılan)', () => {
      expect(buildStaffOrderBy(null, 'asc')).toEqual({ createdAt: 'desc' })
      expect(buildStaffOrderBy('avgScore', 'asc')).toEqual({ createdAt: 'desc' })
      expect(buildStaffOrderBy('completedTrainings', 'desc')).toEqual({ createdAt: 'desc' })
    })
  })
})
