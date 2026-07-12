import { describe, it, expect } from 'vitest'
import { orgStaffWhere, withOrgStaffScope, orgStaffWhereByDept } from '../org-scope'

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

/**
 * `orgStaffWhereByDept` — departman filtresini iki dala AYRI eşler. Kritik tenant kuralı:
 * ortak doktorun departmanı EK hastanede `OrganizationMembership.departmentId`'dir, PRIMARY
 * `User.departmentId` DEĞİL. Bu bozulursa dept-filtreli rapor ya ortak doktoru kaçırır ya da
 * yanlış (primary/A) departmana atar.
 */
describe('orgStaffWhereByDept', () => {
  it('dept filtresi YOKKEN sade orgStaffWhere OR yapısını üretir (inert geçiş)', () => {
    const w = orgStaffWhereByDept('org-A')
    expect(w.role).toBe('staff')
    expect(w.OR).toEqual([
      { organizationId: 'org-A' },
      { memberships: { some: { organizationId: 'org-A', isActive: true } } },
    ])
    expect(w.isActive).toBeUndefined()
  })

  it('departmentId filtresini HER İKİ dala AYRI eşler (primary User.departmentId + üyelik membership.departmentId)', () => {
    const w = orgStaffWhereByDept('org-A', { departmentId: 'dep-B1' }, { isActive: true })
    expect(w.role).toBe('staff')
    expect(w.isActive).toBe(true)
    expect(w.OR).toEqual([
      { organizationId: 'org-A', departmentId: 'dep-B1' },
      { memberships: { some: { organizationId: 'org-A', isActive: true, departmentId: 'dep-B1' } } },
    ])
  })

  it('alt-ağaç dept filtresini ({ in: [...] }) iki dala da taşır', () => {
    const w = orgStaffWhereByDept('org-A', { departmentId: { in: ['d1', 'd2'] } })
    expect(w.OR).toEqual([
      { organizationId: 'org-A', departmentId: { in: ['d1', 'd2'] } },
      { memberships: { some: { organizationId: 'org-A', isActive: true, departmentId: { in: ['d1', 'd2'] } } } },
    ])
  })

  it('isActive verilmezse üst düzey isActive eklenmez (opsiyonel)', () => {
    const w = orgStaffWhereByDept('org-A', { departmentId: 'd1' })
    expect(w.isActive).toBeUndefined()
  })

  it('üyelik dalı HER ZAMAN kendi isActive:true kısıtını taşır (pasif üyelik sızmaz)', () => {
    const w = orgStaffWhereByDept('org-A', { departmentId: 'd1' }, { isActive: false })
    const membershipBranch = w.OR?.find((b) => 'memberships' in b) as {
      memberships: { some: { isActive: boolean } }
    }
    expect(membershipBranch.memberships.some.isActive).toBe(true) // üst düzey isActive:false olsa bile üyelik dalı aktif-only
  })
})
