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

  try {
    await page.goto(`${baseURL}/auth/login`)
    await page.waitForSelector('[type="email"]', { timeout: 20000 })

    await page.fill('[type="email"]', email)
    await page.fill('[type="password"]', password)

    // Shadcn Checkbox: '#kvkk' is a hidden <input aria-hidden="true">.
    // The actual clickable element is <button data-slot="checkbox">.
    // CI'da sayfa render geç tamamlanabilir — 10s bekle, bulamazsan devam et.
    const kvkk = page.locator('button[data-slot="checkbox"]')
    try {
      await kvkk.waitFor({ state: 'visible', timeout: 10000 })
      await kvkk.click()
    } catch {
      // Checkbox yoksa (ya da render gecikmesi) skip et
    }

    await page.click('button[type="submit"]')
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
