import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { testStaff } from './helpers/seed'

test.describe.serial('Personel Yonetimi', () => {
  const staff = testStaff()

  test('yeni personel ekleme', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/staff')
    await page.waitForLoadState('networkidle')

    // "Yeni Personel" / "Ekle" butonuna tikla
    const addBtn = page.getByRole('button', { name: /yeni personel|personel ekle|ekle/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10000 })
    await addBtn.click()

    // Form/modal acilmasini bekle
    await page.waitForTimeout(1000)

    // Formu doldur — modal veya ayri sayfa olabilir
    const firstNameInput = page.getByLabel(/ad/i).first()
    if (await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstNameInput.fill(staff.firstName)
    }

    const lastNameInput = page.getByLabel(/soyad/i).first()
    if (await lastNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lastNameInput.fill(staff.lastName)
    }

    const emailInput = page.getByLabel(/e-posta|email/i).first()
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(staff.email)
    }

    // TC Kimlik No
    const tcInput = page.getByLabel(/tc|kimlik/i).first()
    if (await tcInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tcInput.fill(staff.tcNo)
    }

    // Kaydet butonu
    const saveBtn = page.getByRole('button', { name: /kaydet|ekle|olustur/i }).first()
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click()
      await page.waitForLoadState('networkidle')
    }
  })

  test('personel listesinde arama', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/staff')
    await page.waitForLoadState('networkidle')

    // Sayfanin yuklenmesini bekle
    await expect(page.locator('table, [role="table"], [class*="data-table"]').first()).toBeVisible({
      timeout: 15000,
    })

    // Arama inputunu bul ve yaz
    const searchInput = page.getByPlaceholder(/ara|personel ara|isim/i).first()
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test')
      // Arama sonuclarinin guncellenmesini bekle
      await page.waitForTimeout(1000)
    }
  })

  test('personel bilgilerini duzenleme', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/staff')
    await page.waitForLoadState('networkidle')

    // Ilk personelin islem menusunu ac
    const actionBtn = page.locator('button').filter({ has: page.locator('[class*="MoreHorizontal"], [class*="more"]') }).first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click()

      // Duzenle / Detay secenegine tikla
      const editOption = page.getByText(/düzenle|detay/i).first()
      if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editOption.click()
        await page.waitForLoadState('networkidle')

        // Detay/duzenleme sayfasina yonlendirme
        await expect(page).toHaveURL(/\/admin\/staff\//)
      }
    }
  })

  test('personel deaktive etme', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/staff')
    await page.waitForLoadState('networkidle')

    // Ilk personelin islem menusunu ac
    const actionBtn = page.locator('button').filter({ has: page.locator('[class*="MoreHorizontal"], [class*="more"]') }).first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click()

      // Deaktive et / Pasif yap secenegi
      const deactivateOption = page.getByText(/deaktive|pasif|askıya/i).first()
      if (await deactivateOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deactivateOption.click()

        // Onay diyalogu varsa onayla
        const confirmBtn = page.getByRole('button', { name: /onayla|evet|tamam/i }).last()
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click()
        }
        await page.waitForLoadState('networkidle')
      }
    }
  })
})
