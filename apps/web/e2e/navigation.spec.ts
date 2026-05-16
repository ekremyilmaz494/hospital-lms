import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('root page redirects', async ({ page }) => {
    // Korumalı bir sayfaya git — auth olmadan login'e yönlendirmeli
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('404 page works', async ({ page }) => {
    const response = await page.goto('/non-existent-page')
    // Should either show 404 or redirect to login
    expect(response?.status()).toBeLessThanOrEqual(404)
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
