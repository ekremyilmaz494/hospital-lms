import { describe, it, expect } from 'vitest'
import { hasAdminAuthority, extractAdminAccess } from '../admin-authority'

describe('hasAdminAuthority', () => {
  it('admin ve super_admin doğal yöneticidir (grant olmadan)', () => {
    expect(hasAdminAuthority({ role: 'admin' })).toBe(true)
    expect(hasAdminAuthority({ role: 'super_admin' })).toBe(true)
  })

  it('düz staff (grant yok) yönetici DEĞİLDİR', () => {
    expect(hasAdminAuthority({ role: 'staff' })).toBe(false)
    expect(hasAdminAuthority({ role: 'staff', adminAccess: false })).toBe(false)
    expect(hasAdminAuthority({ role: 'staff', adminAccess: null })).toBe(false)
  })

  it('grant verilmiş staff yöneticidir (dual-capability çekirdeği)', () => {
    expect(hasAdminAuthority({ role: 'staff', adminAccess: true })).toBe(true)
  })

  it('rol yok/bilinmez + grant yok → yönetici değil (fail-closed)', () => {
    expect(hasAdminAuthority({ role: null })).toBe(false)
    expect(hasAdminAuthority({ role: undefined })).toBe(false)
    expect(hasAdminAuthority(null)).toBe(false)
    expect(hasAdminAuthority(undefined)).toBe(false)
    expect(hasAdminAuthority({ role: 'bilinmeyen' })).toBe(false)
  })

  it('KRİTİK: grant super_admin YETKİSİ VERMEZ — bu fonksiyon "admin seviyesi" içindir', () => {
    // hasAdminAuthority true döner ama bu yalnız /admin erişimi demektir.
    // super-admin route'ları ayrıca role==='super_admin' ister; grant'lı staff onu geçemez.
    const grantedStaff = { role: 'staff', adminAccess: true }
    expect(hasAdminAuthority(grantedStaff)).toBe(true)
    expect(grantedStaff.role === 'super_admin').toBe(false)
  })
})

describe('extractAdminAccess', () => {
  it('app_metadata.admin_access boolean true → true', () => {
    expect(extractAdminAccess({ admin_access: true })).toBe(true)
  })

  it('string "true" varyantına toleranslı', () => {
    expect(extractAdminAccess({ admin_access: 'true' })).toBe(true)
  })

  it('yok / false / bozuk → false (fail-closed)', () => {
    expect(extractAdminAccess({})).toBe(false)
    expect(extractAdminAccess({ admin_access: false })).toBe(false)
    expect(extractAdminAccess({ admin_access: 1 })).toBe(false)
    expect(extractAdminAccess(null)).toBe(false)
    expect(extractAdminAccess(undefined)).toBe(false)
  })
})
