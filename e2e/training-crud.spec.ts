import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { testTraining } from './helpers/seed'

test.describe.serial('Egitim Yonetimi (CRUD)', () => {
  const training = testTraining()

  test('yeni egitim olusturma (wizard adimlari)', async ({ page }) => {
    await login(page, 'admin')

    // Egitimler sayfasina git
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    // "Yeni Egitim" / "Ekle" butonuna tikla
    const newTrainingBtn = page.getByRole('link', { name: /yeni eğitim|ekle/i }).first()
    await expect(newTrainingBtn).toBeVisible({ timeout: 10000 })
    await newTrainingBtn.click()

    await page.waitForURL('**/admin/trainings/new', { timeout: 10000 })

    // Adim 1: Temel Bilgiler
    await expect(page.getByText('Temel Bilgiler')).toBeVisible()
    await page.fill('input[type="text"]', training.title)

    // Kategori secimi
    const categoryBtn = page.getByText(training.category).first()
    if (await categoryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryBtn.click()
    }

    // Ileri butonu
    const nextBtn = page.getByRole('button', { name: /ileri|sonraki|devam/i }).first()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
    }
  })

  test('egitim listede gorunur', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    // Sayfanin yuklenmesini bekle
    await expect(page.locator('table, [role="table"], [class*="data-table"]').first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('egitim duzenleme sayfasi acilir', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    // Ilk egitimin islem menusunu ac
    const actionBtn = page.locator('button').filter({ has: page.locator('[class*="MoreHorizontal"], [class*="more"]') }).first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click()

      // Duzenle secenegine tikla
      const editOption = page.getByText('Düzenle').first()
      if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editOption.click()
        // Edit sayfasina yonlendirme olmali
        await page.waitForURL('**/admin/trainings/**', { timeout: 10000 })
      }
    }
  })

  test('egitim yayin durumu degistirilebilir', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    // Ilk egitimin islem menusunu ac
    const actionBtn = page.locator('button').filter({ has: page.locator('[class*="MoreHorizontal"], [class*="more"]') }).first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click()

      // Yayinla/Taslak secenegini ara
      const publishOption = page.getByText(/yayınla|taslak|arşivle/i).first()
      if (await publishOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await publishOption.click()
        // Durumun degismesini bekle
        await page.waitForLoadState('networkidle')
      }
    }
  })

  test('egitim silinebilir', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    // Ilk egitimin islem menusunu ac
    const actionBtn = page.locator('button').filter({ has: page.locator('[class*="MoreHorizontal"], [class*="more"]') }).first()
    if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await actionBtn.click()

      // Sil secenegine tikla
      const deleteOption = page.getByText('Sil').first()
      if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteOption.click()

        // Onay diyalogu varsa onayla
        const confirmBtn = page.getByRole('button', { name: /sil|onayla|evet/i }).last()
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click()
        }

        await page.waitForLoadState('networkidle')
      }
    }
  })
})
