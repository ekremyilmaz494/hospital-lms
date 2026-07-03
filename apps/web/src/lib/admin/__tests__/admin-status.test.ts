import { describe, it, expect } from 'vitest'
import { resolveAdminStatusChange, type AdminStatusTarget } from '@/lib/admin/admin-status'

const ORG = 'org-1'
const OWNER = 'owner-1'

function target(overrides: Partial<AdminStatusTarget> = {}): AdminStatusTarget {
  return { id: 'admin-2', organizationId: ORG, role: 'admin', isActive: true, ...overrides }
}

function call(overrides: Partial<Parameters<typeof resolveAdminStatusChange>[0]> = {}) {
  return resolveAdminStatusChange({
    target: target(),
    orgId: ORG,
    ownerUserId: OWNER,
    requesterId: OWNER,
    action: 'deactivate',
    ...overrides,
  })
}

describe('resolveAdminStatusChange', () => {
  it('Esas Yönetici aktif bir yöneticiyi pasife alabilir → ok', () => {
    expect(call().ok).toBe(true)
  })

  it('pasif yöneticiyi aktifleştirebilir → ok', () => {
    expect(call({ target: target({ isActive: false }), action: 'reactivate' }).ok).toBe(true)
  })

  it('istekte bulunan owner değilse → 403', () => {
    const d = call({ requesterId: 'someone-else' })
    expect(d).toEqual({ ok: false, status: 403, message: expect.any(String) })
  })

  it('ownerUserId null (org sahibi atanmamış) → 403', () => {
    expect(call({ ownerUserId: null, requesterId: OWNER }).ok).toBe(false)
  })

  it('hedef yok → 404', () => {
    const d = call({ target: null })
    expect(d).toMatchObject({ ok: false, status: 404 })
  })

  it('hedef başka org → 404 (fingerprint sızdırma)', () => {
    const d = call({ target: target({ organizationId: 'other-org' }) })
    expect(d).toMatchObject({ ok: false, status: 404 })
  })

  it('Esas Yönetici kendini pasife alamaz → 400', () => {
    const d = call({ target: target({ id: OWNER }) })
    expect(d).toMatchObject({ ok: false, status: 400 })
  })

  it('super_admin hedefi → 403', () => {
    const d = call({ target: target({ role: 'super_admin' }) })
    expect(d).toMatchObject({ ok: false, status: 403 })
  })

  it('staff hedefi → 400 (yanlış akış; grant/revoke kullanılmalı)', () => {
    const d = call({ target: target({ role: 'staff' }) })
    expect(d).toMatchObject({ ok: false, status: 400 })
  })

  it('zaten pasif iken deactivate → 409', () => {
    const d = call({ target: target({ isActive: false }), action: 'deactivate' })
    expect(d).toMatchObject({ ok: false, status: 409 })
  })

  it('zaten aktif iken reactivate → 409', () => {
    const d = call({ target: target({ isActive: true }), action: 'reactivate' })
    expect(d).toMatchObject({ ok: false, status: 409 })
  })
})
