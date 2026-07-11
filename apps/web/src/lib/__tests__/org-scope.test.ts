import { describe, it, expect } from 'vitest'
import { orgStaffWhere, withOrgStaffScope } from '../org-scope'

/**
 * `orgStaffWhere` — ortak personel (çok-hastaneli grup) org-kapsamı. Bir hastanenin personeli
 * primary (User.organizationId) VEYA aktif üyelik (OrganizationMembership) ile bağlı olabilir.
 * Bu filtre yapısı bozulursa staff listesi/atama/rapor paylaşılan çalışanı ya kaçırır ya sızdırır.
 */
describe('orgStaffWhere', () => {
  it('role=staff + (primary org OR aktif üyelik) OR dalını üretir', () => {
    const w = orgStaffWhere('org-A')
    expect(w.role).toBe('staff')
    expect(w.OR).toEqual([
      { organizationId: 'org-A' },
      { memberships: { some: { organizationId: 'org-A', isActive: true } } },
    ])
  })

  it('üyelik dalı yalnız AKTİF üyelikleri kapsar (pasif üyelik personeli göstermez)', () => {
    const w = orgStaffWhere('org-B')
    const membershipBranch = w.OR?.find((b) => 'memberships' in b) as { memberships: { some: { isActive: boolean } } }
    expect(membershipBranch.memberships.some.isActive).toBe(true)
  })
})

describe('withOrgStaffScope', () => {
  it('basit ek filtreyi (departman) AND semantiğiyle spread eder, OR korunur', () => {
    const w = withOrgStaffScope('org-A', { departmentId: 'dep-1' })
    expect(w.role).toBe('staff')
    expect(w.departmentId).toBe('dep-1')
    expect(w.OR).toBeDefined() // primary/üyelik dalı ezilmedi
  })

  it('ek filtre kendi OR\'unu taşırsa (arama) iki OR\'u AND\'ler — biri diğerini EZMEZ', () => {
    const search = { OR: [{ firstName: { contains: 'ali' } }, { lastName: { contains: 'ali' } }] }
    const w = withOrgStaffScope('org-A', search)
    expect(w.role).toBe('staff')
    // Kapsam OR'u ile arama OR'u ayrı AND koşulları olarak durmalı (Prisma tek OR bırakırdı).
    expect(w.AND).toHaveLength(2)
    expect(w.OR).toBeUndefined()
    const [scopeCond, searchCond] = w.AND as Array<Record<string, unknown>>
    expect(scopeCond.OR).toEqual([
      { organizationId: 'org-A' },
      { memberships: { some: { organizationId: 'org-A', isActive: true } } },
    ])
    expect(searchCond).toEqual(search)
  })
})
