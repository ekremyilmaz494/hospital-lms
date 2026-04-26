import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

const LOGIN_FORM_SELECTOR = '[data-testid="login-form"][data-hydrated="true"]'
const LOGIN_SUBMIT_SELECTOR = '[data-testid="login-submit"]'
const KVKK_ACCEPT_BUTTON = /KABUL ED|Kabul Ed/

/**
 * Auth edge case E2E testleri.
 *
 * Kapsam:
 *   - Session timeout UI mesajı (?reason=timeout)
 *   - KVKK reddi sonrası mesaj (?reason=kvkk-rejected)
 *   - Open redirect koruma (?redirectTo=//evil.com → redirect kullanılmaz)
 *   - /api/auth/me — auth'lu vs auth'suz davranış
 *   - /api/auth/logout — başarılı çıkış + cookie temizleme
 *   - Cookie chunking — Supabase chunked auth cookie (sb-xxx-auth-token.0/.1) tanıma
 *
 * NOT: Login API rate limit threshold 100 (IP) / 30 (email) — E2E'de tetiklemek
 * pratik değil (Redis sayacını manuel sıfırlamak gerek). Smoke test bırakıldı.
 */

// Tüm testlerde cookie consent banner dismiss et — submit click'leri intercept ediyor
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true')
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
  })
})

test.describe('Login Sayfası Query Param Davranışı', () => {
  test.describe.configure({ mode: 'serial' })

  test('?reason=timeout → "oturum sonlandırıldı" uyarısı', async ({ page }) => {
    await page.goto('/auth/login?reason=timeout', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/oturumunuz sonlandırıldı/i)).toBeVisible({ timeout: 10000 })
  })

  test('?reason=kvkk-rejected&msg=... → kullanıcı mesajı hata banner\'ında', async ({ page }) => {
    const msg = 'KVKK metnini kabul etmediniz'
    await page.goto(`/auth/login?reason=kvkk-rejected&msg=${encodeURIComponent(msg)}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10000 })
  })

  test('açık ?redirectTo=/admin/dashboard → login sonrası bu yola gider', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/auth/login?redirectTo=/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(LOGIN_FORM_SELECTOR, { timeout: 30000 })
    await page.fill('[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')
    await page.fill('[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? 'E2eTestAdmin123!')
    const submitBtn = page.locator(LOGIN_SUBMIT_SELECTOR)
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })

    // API çağrısı + click'i parallel başlat (race avoid)
    const [loginResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 30000 }),
      submitBtn.click(),
    ])
    expect(loginResp.status(), 'Login API başarılı dönmeli').toBe(200)

    // KVKK Notice Modal opsiyonel
    // KVKK modal: HER login'de açılır (Supabase user_metadata güncellenmez,
    // kvkk DB tablosunda saklanır → her login session'ında modal yeniden gelir)
    const kvkkCheck = page.locator('button[role="checkbox"][aria-checked]')
    await kvkkCheck.waitFor({ state: 'visible', timeout: 10000 })
    await kvkkCheck.click()
    const acceptBtn = page.getByRole('button', { name: KVKK_ACCEPT_BUTTON })
    await acceptBtn.waitFor({ state: 'visible', timeout: 5000 })
    await acceptBtn.click()
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 60000 })
  })

  test('açık redirect saldırısı: ?redirectTo=//evil.com → reddedilir, default route\'a gider', async ({ page }) => {
    test.setTimeout(90000)
    // login/page.tsx:47 — `startsWith('//')` reddediliyor (rawRedirect=null olur)
    await page.goto('/auth/login?redirectTo=//evil.com', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(LOGIN_FORM_SELECTOR, { timeout: 30000 })
    await page.fill('[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@test.local')
    await page.fill('[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? 'E2eTestAdmin123!')
    const submitBtn = page.locator(LOGIN_SUBMIT_SELECTOR)
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })

    const [loginResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 30000 }),
      submitBtn.click(),
    ])
    expect(loginResp.status()).toBe(200)

    // KVKK modal: HER login'de açılır (Supabase user_metadata güncellenmez,
    // kvkk DB tablosunda saklanır → her login session'ında modal yeniden gelir)
    const kvkkCheck = page.locator('button[role="checkbox"][aria-checked]')
    await kvkkCheck.waitFor({ state: 'visible', timeout: 10000 })
    await kvkkCheck.click()
    const acceptBtn = page.getByRole('button', { name: KVKK_ACCEPT_BUTTON })
    await acceptBtn.waitFor({ state: 'visible', timeout: 5000 })
    await acceptBtn.click()

    // Default admin dashboard'a gitmeli — evil.com'a YÖNLENMEMELİ
    await page.waitForURL(/\/(admin|staff|super-admin)\/dashboard/, { timeout: 60000 })
    expect(page.url()).not.toContain('evil.com')
  })
})

test.describe('Auth API Endpoint\'leri', () => {
  test.describe.configure({ mode: 'serial' })

  test('/api/auth/me — auth\'suz → 401', async ({ request }) => {
    const response = await request.get('/api/auth/me')
    expect(response.status()).toBe(401)
  })

  test('/api/auth/me — auth\'lu → kullanıcı bilgileri', async ({ page }) => {
    await login(page, 'admin')

    const response = await page.request.get('/api/auth/me')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.email ?? data.user?.email).toContain('e2e-admin')
  })

  test('/api/auth/logout → başarılı + cookie temizliği', async ({ page, context }) => {
    await login(page, 'admin')

    // Logout öncesi: Supabase chunked cookie var mı?
    const cookiesBefore = await context.cookies()
    const authCookieBefore = cookiesBefore.find(c => c.name.includes('-auth-token'))
    expect(authCookieBefore, 'Login sonrası -auth-token cookie set edilmiş olmalı').toBeTruthy()

    const response = await page.request.post('/api/auth/logout')
    expect([200, 204]).toContain(response.status())

    // Logout sonrası protected route → login'e redirect
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })
})

test.describe('Cookie Chunking (Supabase SSR)', () => {
  test('login sonrası -auth-token içeren cookie set edilir (chunked olabilir)', async ({ page, context }) => {
    test.setTimeout(60000)
    await login(page, 'admin')

    const cookies = await context.cookies()
    // CLAUDE.md kritik kuralı: endsWith('-auth-token') YASAK, includes() kullanılmalı
    // Çünkü Supabase chunked cookie kullanır: sb-xxx-auth-token.0, sb-xxx-auth-token.1
    const authCookies = cookies.filter(c => c.name.includes('-auth-token'))
    expect(authCookies.length, 'En az 1 auth-token cookie\'si olmalı').toBeGreaterThan(0)

    // Cookie httpOnly olmalı (XSS koruması)
    for (const cookie of authCookies) {
      expect(cookie.httpOnly, `${cookie.name} httpOnly olmalı`).toBe(true)
    }
  })
})

test.describe('Login Rate Limit (Smoke)', () => {
  // NOT: Threshold 100 (IP) / 30 (email) — gerçek tetikleme E2E'de impractical.
  // Bu smoke test sadece normal yanlış şifre durumunun 429 değil 401 döndüğünü doğrular.
  test('1 yanlış şifre denemesi → 401, 429 değil (rate limit threshold yüksek)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        email: 'rate-limit-test@test.local',
        password: 'tamamen_yanlis',
        rememberMe: false,
      },
    })
    expect(response.status()).not.toBe(429)
    // 400 veya 401 — invalid credentials
    expect([400, 401]).toContain(response.status())
  })
})
