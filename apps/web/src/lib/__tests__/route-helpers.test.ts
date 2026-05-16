import { describe, it, expect } from 'vitest'
import { getRolePath } from '../route-helpers'

describe('getRolePath', () => {
  it('super_admin için dashboard prefix döndürür', () => {
    expect(getRolePath('super_admin', 'dashboard')).toBe('/super-admin')
  })

  it('admin için dashboard prefix döndürür', () => {
    expect(getRolePath('admin', 'dashboard')).toBe('/admin')
  })

  it('staff için dashboard prefix döndürür', () => {
    expect(getRolePath('staff', 'dashboard')).toBe('/staff')
  })

  it('super_admin/settings → /super-admin/settings', () => {
    expect(getRolePath('super_admin', 'settings')).toBe('/super-admin/settings')
  })

  it('admin/settings → /admin/settings', () => {
    expect(getRolePath('admin', 'settings')).toBe('/admin/settings')
  })

  it('staff/settings → /staff/profile (quirk)', () => {
    expect(getRolePath('staff', 'settings')).toBe('/staff/profile')
  })

  it('staff/notifications → /staff/notifications', () => {
    expect(getRolePath('staff', 'notifications')).toBe('/staff/notifications')
  })

  it('admin/notifications → /admin/notifications', () => {
    expect(getRolePath('admin', 'notifications')).toBe('/admin/notifications')
  })

  it('super_admin/notifications → /admin/notifications (quirk)', () => {
    expect(getRolePath('super_admin', 'notifications')).toBe('/admin/notifications')
  })

  it('staff/profile → /staff/profile', () => {
    expect(getRolePath('staff', 'profile')).toBe('/staff/profile')
  })

  it('undefined rol staff fallback\'ına düşer', () => {
    expect(getRolePath(undefined, 'dashboard')).toBe('/staff')
    expect(getRolePath(undefined, 'settings')).toBe('/staff/profile')
    expect(getRolePath(undefined, 'notifications')).toBe('/staff/notifications')
  })

  it('bilinmeyen rol staff fallback\'ına düşer', () => {
    expect(getRolePath('unknown_role', 'dashboard')).toBe('/staff')
    expect(getRolePath('', 'dashboard')).toBe('/staff')
  })

  it('null rol staff fallback\'ına düşer', () => {
    expect(getRolePath(null, 'dashboard')).toBe('/staff')
  })
})
