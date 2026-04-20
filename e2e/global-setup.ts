/**
 * Playwright Global Setup
 *
 * Tüm testlerden ÖNCE bir kez çalışır.
 * Her rol için login yapıp browser state'ini (cookie/localStorage) dosyaya kaydeder.
 * Testler bu state'i kullanarak re-login yapmadan başlar → CI'da ~3-4x hız kazanımı.
 *
 * Üretilen dosyalar:
 *   .playwright/admin.json
 *   .playwright/staff.json
 *   .playwright/super_admin.json
 */
import { chromium, type FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const CREDENTIALS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? '',
    password: process.env.E2E_ADMIN_PASSWORD ?? '',
    dashboard: '/admin/dashboard',
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL ?? '',
    password: process.env.E2E_STAFF_PASSWORD ?? '',
    dashboard: '/staff/dashboard',
  },
  super_admin: {
    email: process.env.E2E_SUPER_EMAIL ?? '',
    password: process.env.E2E_SUPER_PASSWORD ?? '',
    dashboard: '/super-admin/dashboard',
  },
}

const STATE_DIR = path.join(process.cwd(), '.playwright')

async function loginAndSave(
  role: keyof typeof CREDENTIALS,
  baseURL: string,
) {
  const { email, password, dashboard } = CREDENTIALS[role]

  // Credentials yoksa skip et (local geliştirme ortamında env set edilmemiş olabilir)
  if (!email || !password) {
    console.log(`[global-setup] ${role}: credentials yok, skip`)
    return
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Cookie consent banner submit'i intercept ediyor (z-[9999] fixed bottom).
  // Pre-dismiss: localStorage key'leri set et — banner mount'ta kendini gizler.
  await page.addInitScript(() => {
    localStorage.setItem('lms_cookie_consent', 'true')
    localStorage.setItem('lms_cookie_prefs', JSON.stringify({ essential: true, functional: true, analytics: true }))
  })

  try {
    await page.goto(`${baseURL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[type="email"]', { timeout: 30000 })

    await page.fill('[type="email"]', email)
    await page.fill('[type="password"]', password)

    // KVKK checkbox login form'undan kaldırıldı (Nisan 2026). Submit zımni kabul.

    // ShimmerButton dynamic import → text-based selector (placeholder text'siz)
    const submitBtn = page.getByRole('button', { name: /Giriş Yap/i })
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 })
    await submitBtn.click()

    // KVKK Notice Modal: önce checkbox (accepted=true), sonra "Kabul Ediyorum" butonu enable
    try {
      const kvkkCheck = page.locator('button[role="checkbox"][aria-checked]')
      await kvkkCheck.waitFor({ state: 'visible', timeout: 8000 })
      await kvkkCheck.click()
      const acceptBtn = page.getByRole('button', { name: /Kabul Ediyorum/i })
      await acceptBtn.waitFor({ state: 'visible', timeout: 3000 })
      await acceptBtn.click()
    } catch { /* modal yok */ }

    await page.waitForURL(`**${dashboard}`, { timeout: 30000 })

    // Session'ı kaydet
    const stateFile = path.join(STATE_DIR, `${role}.json`)
    await context.storageState({ path: stateFile })
    console.log(`[global-setup] ${role}: login tamam → ${stateFile}`)
  } catch (err) {
    console.warn(`[global-setup] ${role}: login başarısız —`, (err as Error).message)
    // Hata fırlatma — testler state olmadan da çalışır (login helper'ı kullanır)
  } finally {
    await browser.close()
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'

  // State dizinini oluştur
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }

  // Rolleri sırayla login yap (paralel yapılırsa Supabase rate limit'e girebilir)
  await loginAndSave('admin', baseURL)
  await loginAndSave('staff', baseURL)
  await loginAndSave('super_admin', baseURL)
}
