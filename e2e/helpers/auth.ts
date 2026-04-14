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

  await page.goto('/auth/login')
  await page.waitForSelector('[type="email"]', { timeout: 15000 })

  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)

  // Shadcn Checkbox: '#kvkk' is a hidden <input aria-hidden="true">.
  // The actual clickable element is <button data-slot="checkbox">.
  const kvkkCheckbox = page.locator('button[data-slot="checkbox"]')
  if (await kvkkCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await kvkkCheckbox.click()
  }

  await page.click('button[type="submit"]')
  await page.waitForURL(`**${dashboard}`, { timeout: 20000 })
}

/**
 * Logout helper — clicks the logout button in sidebar and verifies redirect to login.
 */
export async function logout(page: Page) {
  // Try sidebar logout first, then topbar dropdown
  const sidebarLogout = page.getByText('Çıkış Yap').first()
  if (await sidebarLogout.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarLogout.click()
  } else {
    // Topbar avatar dropdown
    const avatarBtn = page.locator('[class*="avatar"]').first()
    await avatarBtn.click()
    await page.getByText('Çıkış Yap').click()
  }

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
