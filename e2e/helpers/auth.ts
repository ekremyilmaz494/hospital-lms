import { type Page, expect } from '@playwright/test'

export type UserRole = 'admin' | 'staff' | 'super_admin'

const CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  admin: { email: 'admin@demo.com', password: 'demo123456' },
  staff: { email: 'staff@demo.com', password: 'demo123456' },
  super_admin: { email: 'super@demo.com', password: 'demo123456' },
}

const DASHBOARD_ROUTES: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
  super_admin: '/super-admin/dashboard',
}

/**
 * Login helper — navigates to login page, fills credentials, accepts KVKK,
 * and submits. Waits until redirected to the expected dashboard.
 */
export async function login(page: Page, role: UserRole = 'admin') {
  const { email, password } = CREDENTIALS[role]

  await page.goto('/auth/login')
  await page.waitForSelector('[type="email"]', { timeout: 10000 })

  await page.fill('[type="email"]', email)
  await page.fill('[type="password"]', password)

  // KVKK checkbox — required before submit
  const kvkkCheckbox = page.locator('#kvkk')
  await kvkkCheckbox.click()

  await page.click('button[type="submit"]')

  // Wait for navigation to dashboard
  const expectedPath = DASHBOARD_ROUTES[role]
  await page.waitForURL(`**${expectedPath}`, { timeout: 15000 })
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
