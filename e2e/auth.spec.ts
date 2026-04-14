import { test, expect } from '@playwright/test'
import { login, logout } from './helpers/auth'

test.describe('Kimlik Dogrulama Akislari', () => {
  test('basarili giris → dashboard yonlendirmesi', async ({ page }) => {
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    // Dashboard iceriginin yuklendigini dogrula
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('yanlis sifre → hata mesaji gosterilir', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('[type="email"]', 'test@example.com')
    await page.fill('[type="password"]', 'yanlis_sifre_123')

    // KVKK checkbox
    await page.locator('#kvkk').click()

    await page.click('button[type="submit"]')

    // Hata mesajini bekle
    await expect(
      page.getByText(/hatalı|hata oluştu|E-posta veya şifre/i)
    ).toBeVisible({ timeout: 10000 })

    // Hala login sayfasinda olmali
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('bos form gonderimi → validasyon hatalari', async ({ page }) => {
    await page.goto('/auth/login')

    // KVKK onaylamadan gonder
    await page.click('button[type="submit"]')

    // KVKK hata mesaji gosterilmeli
    await expect(
      page.getByText(/KVKK metnini onaylamanız zorunludur/i)
    ).toBeVisible({ timeout: 5000 })
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
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('yetkisiz sayfa erisimi (staff) → login sayfasina yonlendirme', async ({ page }) => {
    await page.goto('/staff/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })

  test('yetkisiz sayfa erisimi (super-admin) → login sayfasina yonlendirme', async ({ page }) => {
    await page.goto('/super-admin/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 })
  })
})
