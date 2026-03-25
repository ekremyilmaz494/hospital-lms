import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByText('Hos Geldiniz')).toBeVisible()
    await expect(page.getByPlaceholder('ornek@hastane.com')).toBeVisible()
  })

  test('should show error with wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('[type="email"]', 'wrong@test.com')
    await page.fill('[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.getByText('hatali')).toBeVisible({ timeout: 5000 })
  })

  test('should have demo account buttons', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByText('DEMO HESAPLAR')).toBeVisible()
    await expect(page.getByText('Super Admin')).toBeVisible()
    await expect(page.getByText('Hastane Admin')).toBeVisible()
    await expect(page.getByText('Personel')).toBeVisible()
  })

  test('demo account button fills form', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByText('Super Admin').click()
    await expect(page.locator('[type="email"]')).toHaveValue('super@demo.com')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('Role-based Access', () => {
  // These tests require a running Supabase instance with demo accounts
  // Skip in CI without proper env setup

  test.skip('admin cannot access super-admin pages', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login')
    await page.fill('[type="email"]', 'admin@demo.com')
    await page.fill('[type="password"]', 'demo123456')
    await page.click('button[type="submit"]')

    // Try to access super-admin
    await page.goto('/super-admin/dashboard')
    await expect(page).not.toHaveURL(/\/super-admin/)
  })
})
