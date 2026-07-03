import { describe, it, expect } from 'vitest'
import { classifyExistingTcUser, type ExistingTcUser } from '@/lib/admin/invite-existing-user'

const ORG = 'org-1'

function make(overrides: Partial<ExistingTcUser> = {}): ExistingTcUser {
  return {
    id: 'user-1',
    organizationId: ORG,
    role: 'staff',
    firstName: 'Enes',
    lastName: 'Yuldaş',
    adminAccessGranted: false,
    isActive: true,
    ...overrides,
  }
}

describe('classifyExistingTcUser', () => {
  it('başka kuruma kayıtlı kullanıcı → other-org', () => {
    const d = classifyExistingTcUser(make({ organizationId: 'other-org' }), ORG)
    expect(d.kind).toBe('other-org')
  })

  it('organizationId null (global) → other-org', () => {
    const d = classifyExistingTcUser(make({ organizationId: null }), ORG)
    expect(d.kind).toBe('other-org')
  })

  it('aynı kurumda admin rolü → already-admin (grant değil)', () => {
    const d = classifyExistingTcUser(make({ role: 'admin' }), ORG)
    expect(d.kind).toBe('already-admin')
    if (d.kind === 'already-admin') expect(d.fullName).toBe('Enes Yuldaş')
  })

  it('super_admin rolü → already-admin', () => {
    expect(classifyExistingTcUser(make({ role: 'super_admin' }), ORG).kind).toBe('already-admin')
  })

  it('yetkisi zaten verilmiş personel → already-granted', () => {
    const d = classifyExistingTcUser(make({ adminAccessGranted: true }), ORG)
    expect(d.kind).toBe('already-granted')
  })

  it('pasif personel → inactive-staff (önce aktifleştir)', () => {
    const d = classifyExistingTcUser(make({ isActive: false }), ORG)
    expect(d.kind).toBe('inactive-staff')
  })

  it('aktif, yetkisiz personel → grantable-staff (id + isim taşınır)', () => {
    const d = classifyExistingTcUser(make({ id: 'staff-42' }), ORG)
    expect(d.kind).toBe('grantable-staff')
    if (d.kind === 'grantable-staff') {
      expect(d.id).toBe('staff-42')
      expect(d.firstName).toBe('Enes')
      expect(d.lastName).toBe('Yuldaş')
      expect(d.fullName).toBe('Enes Yuldaş')
    }
  })

  it('öncelik: pasif VE yetkili aynı anda ise already-granted, inactive değil', () => {
    // adminAccessGranted kontrolü isActive kontrolünden önce → yetkili pasif personel
    // "already-granted" döner (grant tekrarına gerek yok, aktiflik ikincil).
    const d = classifyExistingTcUser(make({ adminAccessGranted: true, isActive: false }), ORG)
    expect(d.kind).toBe('already-granted')
  })
})
