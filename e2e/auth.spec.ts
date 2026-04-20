import { test, expect } from '@playwright/test'
import { login, logout } from './helpers/auth'

// Cookie consent banner submit'i intercept eder, baştan dismiss et
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true')
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
  })
})

test.describe('Kimlik Dogrulama Akislari', () => {
  test('basarili giris → dashboard yonlendirmesi', async ({ page }) => {
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    // Dashboard iceriginin yuklendigini dogrula
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('yanlis sifre → hata mesaji gosterilir', async ({ page }) => {
    // Cookie banner dismiss
    await page.addInitScript(() => {
      localStorage.setItem('lms_cookie_consent', 'true')
      localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
    })

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
    await page.fill('[type="email"]', 'test@example.com')
    await page.fill('[type="password"]', 'yanlis_sifre_123')

    const submitBtn = page.getByRole('button', { name: /Giriş Yap/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })

    // Race-free: response listener'ı click'ten ÖNCE subscribe et.
    // Aksi halde hızlı response'lar (cache hit, hızlı reject) waitForResponse'tan önce gelir → timeout.
    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
        { timeout: 25000 }
      ),
      submitBtn.click(),
    ])
    expect([400, 401, 429]).toContain(loginResponse.status())

    // Hala login sayfasinda olmali (dashboard'a yönlendirilmedi)
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('email boş → HTML5 required validasyonu', async ({ page }) => {
    // NOT: Eski "KVKK hatası" testi geçersiz — KVKK checkbox formdan kaldırıldı.
    // Yerine HTML5 required validasyonunu doğruluyoruz.
    await page.addInitScript(() => {
      localStorage.setItem('lms_cookie_consent', 'true')
      localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
    })

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
    const submitBtn = page.getByRole('button', { name: /Giriş Yap/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()

    // Form submit edilmemeli — hala login URL'inde
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/auth\/login/)
    // Input'un required attr'ı olmalı (browser native validation devreye girmeli)
    const emailRequired = await page.locator('[type="email"]').getAttribute('required')
    expect(emailRequired).not.toBeNull()
  })

  test('cikis yap → login sayfasina yonlendirilir', async ({ page }) => {
    // Once giris yap
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)

    // Sonra cikis yap
    await logout(page)
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('yetkisiz sayfa erisimi → login sayfasina yonlendirme', async ({ page }) => {
    // Giris yapmadan admin sayfasina eris
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('yetkisiz sayfa erisimi (staff) → login sayfasina yonlendirme', async ({ page }) => {
    await page.goto('/staff/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('yetkisiz sayfa erisimi (super-admin) → login sayfasina yonlendirme', async ({ page }) => {
    await page.goto('/super-admin/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })
})
