import { type Page, type BrowserContext, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

export type UserRole = 'admin' | 'staff' | 'super_admin'

const CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? '', password: process.env.E2E_ADMIN_PASSWORD ?? '' },
  staff: { email: process.env.E2E_STAFF_EMAIL ?? '', password: process.env.E2E_STAFF_PASSWORD ?? '' },
  super_admin: { email: process.env.E2E_SUPER_EMAIL ?? '', password: process.env.E2E_SUPER_PASSWORD ?? '' },
}

const DASHBOARD_ROUTES: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
  super_admin: '/super-admin/dashboard',
}

const STATE_DIR = path.join(process.cwd(), '.playwright')

/**
 * Global setup'ın kaydettiği storageState dosyası var mı kontrol et.
 * Varsa context'e uygula — re-login gerekmiyor.
 */
export async function applyStoredAuth(context: BrowserContext, role: UserRole): Promise<boolean> {
  const stateFile = path.join(STATE_DIR, `${role}.json`)
  if (!fs.existsSync(stateFile)) return false

  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
    await context.addCookies(state.cookies ?? [])
    return true
  } catch {
    return false
  }
}

/**
 * Login helper — önce global-setup'ın kaydettiği session'ı dene.
 * Session yoksa gerçek login yapar.
 */
export async function login(page: Page, role: UserRole = 'admin') {
  const dashboard = DASHBOARD_ROUTES[role]

  // Cookie consent banner (fixed bottom, z-[9999]) submit butonunu intercept ediyor — önceden kabul et
  await page.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true')
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
  })

  // Önce kaydedilmiş session ile dene
  const stateFile = path.join(STATE_DIR, `${role}.json`)
  if (fs.existsSync(stateFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
      await page.context().addCookies(state.cookies ?? [])
      await page.goto(dashboard)

      // Hâlâ login sayfasına yönlendirmediyse session geçerli
      await page.waitForURL(`**${dashboard}`, { timeout: 8000 })
      return
    } catch {
      // Session geçersiz — normal login yap
    }
  }

  // Normal login akışı
  const { email, password } = CREDENTIALS[role]

  // 'load' yerine 'domcontentloaded' — Turbopack dev'de chunk'lar lazy compile,
  // 'load' tüm dynamic import'ların bitmesini bekleyip 30s timeout veriyor.
  // Email selector zaten waitForSelector ile beklenecek, asset yüklenmesini beklemeye gerek yok.
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[type="email"]', { timeout: 30000 })

  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)

  // NOT: Login formundan KVKK checkbox kaldırıldı (Nisan 2026 UI revizyonu).
  // KVKK metni bilgilendirme paragrafı, submit ile zımni kabul ediliyor.
  // Acknowledgement'ı kullanıcı login sonrası KvkkNoticeModal'da yapıyor.
  // Tek checkbox kaldı: rememberMe (Bu cihazda oturumumu açık tut).

  // ShimmerButton dynamic import — placeholder mount olana kadar gerçek button beklenmeli.
  // Placeholder'da text yok; submit butonu "Giriş Yap" text'i içeriyor.
  const submitBtn = page.getByRole('button', { name: /Giriş Yap/i })
  await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
  await submitBtn.click()

  // Login sonrası KVKK Notice Modal açılır (E2E user'ların acknowledged metadata'sı yok).
  // Modal yapısı: önce role=checkbox tıklanır (accepted=true), sonra "Kabul Ediyorum" butonu enable olur.
  try {
    const kvkkCheck = page.locator('button[role="checkbox"][aria-checked]')
    await kvkkCheck.waitFor({ state: 'visible', timeout: 8000 })
    await kvkkCheck.click()
    const acceptBtn = page.getByRole('button', { name: /Kabul Ediyorum/i })
    await acceptBtn.waitFor({ state: 'visible', timeout: 3000 })
    await acceptBtn.click()
  } catch {
    // Modal yoksa zaten dashboard'a yönlendi — devam
  }

  await page.waitForURL(`**${dashboard}`, { timeout: 30000 })
}

/**
 * Logout helper — API-based to avoid Next.js dev overlay (`<nextjs-portal>`)
 * intercepting clicks on sidebar/avatar buttons.
 */
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout')
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await page.waitForURL('**/auth/login', { timeout: 10000 })
}

/**
 * Verify user is on a specific dashboard
 */
export async function expectDashboard(page: Page, role: UserRole) {
  const path = DASHBOARD_ROUTES[role]
  await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')))
}

export { CREDENTIALS, DASHBOARD_ROUTES }
