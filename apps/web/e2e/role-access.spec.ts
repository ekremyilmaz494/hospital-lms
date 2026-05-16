import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Rol Bazli Erisim Kontrolu', () => {
  test.describe('Personel kisitlamalari', () => {
    test('personel /admin sayfasina erisemez', async ({ page }) => {
      await login(page, 'staff')
      await expect(page).toHaveURL(/\/staff\/dashboard/)

      // Admin sayfasina gitmeyi dene
      await page.goto('/admin/dashboard')

      // Login'e veya kendi paneline yonlendirilmeli
      await page.waitForTimeout(2000)
      const url = page.url()
      expect(url).not.toMatch(/\/admin\/dashboard/)
    })

    test('personel /super-admin sayfasina erisemez', async ({ page }) => {
      await login(page, 'staff')

      await page.goto('/super-admin/dashboard')

      await page.waitForTimeout(2000)
      const url = page.url()
      expect(url).not.toMatch(/\/super-admin\/dashboard/)
    })

    test('personel kendi panelini gorur', async ({ page }) => {
      await login(page, 'staff')

      // Staff dashboard gorunmeli
      await expect(page).toHaveURL(/\/staff\/dashboard/)

      // Sayfa iceriginin yuklenmesini bekle
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).not.toBeEmpty()
    })
  })

  test.describe('Admin kisitlamalari', () => {
    test('admin /super-admin sayfasina erisemez', async ({ page }) => {
      await login(page, 'admin')

      await page.goto('/super-admin/dashboard')

      await page.waitForTimeout(2000)
      const url = page.url()
      expect(url).not.toMatch(/\/super-admin\/dashboard/)
    })

    test('admin kendi panelini gorur', async ({ page }) => {
      await login(page, 'admin')

      await expect(page).toHaveURL(/\/admin\/dashboard/)
      await page.waitForLoadState('networkidle')

      // Admin sidebar navigasyonu gorunmeli
      const sidebar = page.locator('aside, nav, [class*="sidebar"]').first()
      await expect(sidebar).toBeVisible({ timeout: 10000 })
    })

    test('admin egitimler sayfasina erisebilir', async ({ page }) => {
      await login(page, 'admin')

      await page.goto('/admin/trainings')
      await page.waitForLoadState('networkidle')

      // Egitimler sayfasi yuklenmeli (redirect olmamalı)
      await expect(page).toHaveURL(/\/admin\/trainings/)
    })

    test('admin personel sayfasina erisebilir', async ({ page }) => {
      await login(page, 'admin')

      await page.goto('/admin/staff')
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(/\/admin\/staff/)
    })

    test('admin raporlar sayfasina erisebilir', async ({ page }) => {
      await login(page, 'admin')

      await page.goto('/admin/reports')
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(/\/admin\/reports/)
    })

    test('admin ayarlar sayfasina erisebilir', async ({ page }) => {
      await login(page, 'admin')

      await page.goto('/admin/settings')
      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(/\/admin\/settings/)
    })
  })

  test.describe('Her rol kendi panelini gorur', () => {
    test('admin girisi → admin dashboard', async ({ page }) => {
      await login(page, 'admin')
      await expect(page).toHaveURL(/\/admin\/dashboard/)
    })

    test('personel girisi → staff dashboard', async ({ page }) => {
      await login(page, 'staff')
      await expect(page).toHaveURL(/\/staff\/dashboard/)
    })
  })
})
