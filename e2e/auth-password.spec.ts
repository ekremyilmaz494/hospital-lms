import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Şifre yönetimi E2E testleri.
 *
 * Kapsam:
 *   - Forgot password: UI form + güvenlik (var/yok sızdırma) + client throttle
 *   - Change password: auth'lu kullanıcı + yanlış mevcut şifre + zayıf şifre
 *
 * Reset-password sayfası test edilmiyor: gerçek email link gerektirir,
 * Supabase magic link mock olmadan E2E'de güvenilir test edilemez.
 * (Bu coverage gap'i auth-password.spec.ts üst yorumunda not edildi.)
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true')
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
  })
})

test.describe('Şifremi Unuttum Akışı', () => {
  test('boş email → HTML5 required validasyonu', async ({ page }) => {
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    // ShimmerButton dynamic import: text-based selector beklenir
    const submitBtn = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()
    // HTML5 required: form submit edilmez, loading spinner çıkmaz
    await expect(page.getByText(/Gönderiliyor/i)).not.toBeVisible({ timeout: 1000 })
  })

  test('geçersiz email formatı → HTML5 type=email validasyonu', async ({ page }) => {
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', 'gecersiz-email')
    // ShimmerButton dynamic import: text-based selector beklenir
    const submitBtn = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()
    // Browser native validasyon — form submit edilmez
    await expect(page.getByText(/E-posta Gönderildi/i)).not.toBeVisible({ timeout: 1000 })
  })

  // SKIP: Supabase test/.local domain'leri "Email address is invalid" ile reddediyor.
  // Gerçek email gerektirir → E2E'de güvenilir test edilemez.
  test.skip('var olan email → başarı mesajı', async ({ page }) => {
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')
    // ShimmerButton dynamic import: text-based selector beklenir
    const submitBtn = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()

    // Supabase resetPasswordForEmail çağrısı → 1-3s alabilir
    await expect(page.getByText(/E-posta Gönderildi/i)).toBeVisible({ timeout: 30000 })
    // Email'in metinde göründüğünü doğrula (kullanıcıya hangi adrese gittiğini hatırlatma)
    await expect(page.getByText(process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')).toBeVisible()
  })

  test('var olmayan email → güvenlik: aynı başarı mesajı (var/yok sızdırma yok)', async ({ page }) => {
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', 'kesinlikle-yok-12345@test.local')
    // ShimmerButton dynamic import: text-based selector beklenir
    const submitBtn = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()

    // KRİTİK güvenlik: kullanıcı var/yok bilgisi UI'a sızdırılmamalı
    // Supabase 'User not found' hatası dönse bile UI 'sent=true' yapıyor
    await expect(page.getByText(/E-posta Gönderildi/i)).toBeVisible({ timeout: 30000 })
  })

  // SKIP: Throttle testi 1. deneme başarısı varsayar — Supabase .local reddediyor.
  test.skip('60sn içinde 2. deneme → client-side throttle hatası', async ({ page, context }) => {
    // Test izolasyonu: bu testin localStorage'i temiz başlamalı
    await context.clearCookies()

    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')
    // ShimmerButton dynamic import: text-based selector beklenir
    const submitBtn = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()
    await expect(page.getByText(/E-posta Gönderildi/i)).toBeVisible({ timeout: 30000 })

    // Login sayfasına dön + tekrar forgot-password (aynı tab → localStorage korunur)
    await page.goto('/auth/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')
    const submitBtn2 = page.getByRole('button', { name: /Sıfırlama Bağlantısı Gönder|Gönderiliyor/i })
    await submitBtn2.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn2.click()

    // 60sn throttle hatası gösterilmeli
    await expect(page.getByText(/1 dakika bekleyin/i)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Şifre Değiştirme (Auth\'lu Kullanıcı)', () => {
  test('change-password sayfasına yetkisiz erişim → login\'e yönlendir', async ({ page }) => {
    await page.goto('/auth/change-password', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('yanlış mevcut şifre → 400 hata', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.post('/api/auth/change-password', {
      data: {
        currentPassword: 'tamamen_yanlis_sifre_xyz',
        newPassword: 'YeniSifre123!',
        confirmPassword: 'YeniSifre123!',
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/mevcut şifre hatalı/i)
  })

  test('yeni şifre 8 karakterden kısa → validasyon hatası', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.post('/api/auth/change-password', {
      data: {
        currentPassword: process.env.E2E_ADMIN_PASSWORD ?? 'E2eTestAdmin123!',
        newPassword: 'kisa',
        confirmPassword: 'kisa',
      },
    })

    expect(response.status()).toBe(400)
  })

  test('yeni şifre + confirm uyuşmuyor → validasyon hatası', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.post('/api/auth/change-password', {
      data: {
        currentPassword: process.env.E2E_ADMIN_PASSWORD ?? 'E2eTestAdmin123!',
        newPassword: 'YeniSifre123!',
        confirmPassword: 'FarkliSifre456!',
      },
    })

    expect(response.status()).toBe(400)
  })

  // NOT: Başarılı şifre değiştirme testi YAZILMADI çünkü test kullanıcısının
  // şifresini değiştirmek diğer testleri kırar (E2E_ADMIN_PASSWORD env'i geçersiz olur).
  // Eğer eklenecekse: önce yeni şifreye değiştir, test sonunda finally bloğunda eski
  // şifreye geri döndür. Şimdilik validation guardlarını test etmek yeterli.
})
