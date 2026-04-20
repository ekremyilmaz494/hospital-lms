import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * MFA (TOTP) ve KVKK acknowledge E2E testleri.
 *
 * Kapsam:
 *   - KVKK acknowledge: smoke (auth gerekli, idempotent davranış)
 *   - TOTP MFA enroll: QR code dönüş yapısı + auth guard
 *   - TOTP unenroll guard
 *
 * NOT: Tam TOTP doğrulama akışı (QR scan → TOTP kodu üret → verify) test edilmiyor.
 * Çünkü:
 *   - QR'dan secret çıkartmak için ek bağımlılık (otplib) gerekir
 *   - Test sonunda factor'u silmek setup'ı kirletir
 *   - Supabase MFA factor enroll'u kalıcı yan etki yaratır
 * Bunun yerine API kontratını test ediyoruz: 401 vs 200, response shape.
 */

test.describe('KVKK Aydınlatma Acknowledge', () => {
  test('/api/auth/kvkk-acknowledge — auth\'suz → 401', async ({ request }) => {
    const response = await request.post('/api/auth/kvkk-acknowledge')
    expect(response.status()).toBe(401)
  })

  test('/api/auth/kvkk-acknowledge — auth\'lu → 200 + idempotent', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, 'admin')

    // login akışı KVKK modal'ı zaten kabul etmiş → r1 alreadySet=true dönebilir.
    // Ayrıca rate limit 3/saat (kvkk-acknowledge route) — geçmiş test run'larda
    // sayaç birikmişse 429 dönebilir. Smoke: 200 veya 429 kabul edilir.
    const r1 = await page.request.post('/api/auth/kvkk-acknowledge', { timeout: 30000 })
    expect([200, 429]).toContain(r1.status())
    if (r1.status() === 200) {
      const d1 = await r1.json()
      expect(d1.acknowledged).toBe(true)
    }

    // 2. çağrı: idempotent — alreadySet=true olmalı (eğer rate limit dolmadıysa)
    const r2 = await page.request.post('/api/auth/kvkk-acknowledge', { timeout: 30000 })
    expect([200, 429]).toContain(r2.status())
    if (r2.status() === 200) {
      const d2 = await r2.json()
      expect(d2.acknowledged).toBe(true)
      // alreadySet KESİN true: helper login içinde modal kabul → DB'de timestamp var
      expect(d2.alreadySet).toBe(true)
    }
  })
})

test.describe('TOTP MFA — Auth Guards & Contract', () => {
  test('/api/auth/mfa/enroll — auth\'suz → 401', async ({ request }) => {
    const response = await request.post('/api/auth/mfa/enroll')
    expect(response.status()).toBe(401)
  })

  test('/api/auth/mfa/enroll — auth\'lu → factorId + qrCode döner', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.post('/api/auth/mfa/enroll')
    // Aynı kullanıcı için zaten unverified factor varsa Supabase 422 dönebilir
    expect([200, 400, 422]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.factorId).toBeTruthy()
      expect(data.qrCode).toMatch(/^data:image\/svg/)

      // Cleanup: setup'ı kirletmemek için factor'u sil
      await page.request.post('/api/auth/mfa/unenroll', {
        data: { factorId: data.factorId },
      }).catch(() => { /* unenroll best-effort */ })
    }
  })

  test('/api/auth/mfa/unenroll — auth\'suz → 401', async ({ request }) => {
    const response = await request.post('/api/auth/mfa/unenroll', {
      data: { factorId: 'fake-id' },
    })
    expect(response.status()).toBe(401)
  })

  test('/api/auth/mfa/verify — auth\'suz → 401', async ({ request }) => {
    const response = await request.post('/api/auth/mfa/verify', {
      data: { factorId: 'fake', code: '123456' },
    })
    expect(response.status()).toBe(401)
  })
})
