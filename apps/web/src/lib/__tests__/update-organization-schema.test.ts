import { describe, it, expect } from 'vitest'
import { updateOrganizationSchema } from '../validations'

/**
 * Regresyon: super-admin "Organizasyon Düzenle" (PATCH /api/super-admin/organizations/[id])
 * "İşlem sırasında beklenmeyen bir hata" veriyordu. Kök neden — createOrganizationSchema'nın
 * `trialDays: z.number().default(14)` alanı `.partial()` ile devralınınca her PATCH payload'ına
 * `trialDays: 14` ENJEKTE ediyor; `prisma.organization.update({ data })` bu kolonu tanımadığı
 * için "Unknown argument trialDays" → 500. Fix: update şeması planId/trialDays'i omit eder.
 */
describe('updateOrganizationSchema — Organization dışı alan sızdırmaz', () => {
  it('trialDays/planId parsed.data\'ya ENJEKTE OLMAZ (Prisma 500 önlenir)', () => {
    const parsed = updateOrganizationSchema.parse({ name: 'Test Kurum', maxStaff: 150 })
    expect(parsed).not.toHaveProperty('trialDays')
    expect(parsed).not.toHaveProperty('planId')
  })

  it('edit formunun gönderdiği body yalnız Organization alanlarına indirgenir', () => {
    const body = {
      name: 'Özel Devakent Hastanesi',
      address: 'Esenler, Akbörk sokak No:4',
      phone: '444 8677',
      email: 'bilgi@devakent.com.tr',
      logoUrl: '/logos/devakent.png',
      status: 'Aktif', // Organization alanı değil → silinmeli
      plan: 'Başlangıç', // Organization alanı değil → silinmeli
      expiresAt: '', // Organization alanı değil → silinmeli
      maxStaff: 150,
    }
    const parsed = updateOrganizationSchema.parse(body)
    expect(Object.keys(parsed).sort()).toEqual(
      ['address', 'email', 'logoUrl', 'maxStaff', 'name', 'phone'],
    )
    expect(parsed.maxStaff).toBe(150)
  })

  it('maxStaff = null (limiti kaldır) geçerli', () => {
    const parsed = updateOrganizationSchema.parse({ maxStaff: null })
    expect(parsed.maxStaff).toBeNull()
    expect(parsed).not.toHaveProperty('trialDays')
  })
})
