import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Kritik kullanıcı zinciri: admin atama yetkisi → staff atanan eğitim listesi →
 * eğitim akışına giriş → sertifika sayfası ulaşılabilirliği.
 *
 * Bu test yeni bir kayıt OLUŞTURMAZ — production-benzeri seed üzerinde haritayı
 * uçtan uca dolaşır. Veri yoksa "boş durum" UI'ları doğrulanır; veri varsa
 * happy-path navigasyonu doğrulanır. Amaç: 227 route'luk yüzey üzerinde tek bir
 * smoke testle "sistem nefes alıyor mu?" sorusunu cevaplamak.
 */
test.describe.serial('Kritik Akış: atama → video → sınav → sertifika', () => {
  test('admin: eğitim listesi sayfası açılır ve atama akışına ulaşılır', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/trainings', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/admin\/trainings/)
    await expect(page.locator('body')).not.toBeEmpty()

    const hasTrainings = await page.getByText(/eğitim|toplam|aktif/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmptyState = await page.getByText(/henüz|bulunamadı|yeni eğitim/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasTrainings || hasEmptyState).toBeTruthy()
  })

  test('staff: atanan eğitim listesi açılır', async ({ page }) => {
    await login(page, 'staff')
    await page.goto('/staff/my-trainings', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/staff\/my-trainings/)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('staff: eğitim varsa akışa girilir, yoksa empty state doğrulanır', async ({ page }) => {
    await login(page, 'staff')
    await page.goto('/staff/my-trainings', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const startLink = page.getByRole('link', { name: /başla|devam|sınava|izle/i }).first()
    const hasStart = await startLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasStart) {
      await startLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toMatch(/\/(exam|staff)\//)
      await expect(page.locator('body')).not.toBeEmpty()
    } else {
      const empty = await page.getByText(/henüz|bulunamadı|atanmış/i).first().isVisible({ timeout: 3000 }).catch(() => false)
      expect(empty).toBeTruthy()
    }
  })

  test('staff: sertifikalar sayfası render olur', async ({ page }) => {
    await login(page, 'staff')
    const response = await page.goto('/staff/certificates', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    expect(response?.status() ?? 0).toBeLessThan(500)
    await expect(page).toHaveURL(/\/staff\/certificates/)
    await expect(page.locator('body')).not.toBeEmpty()

    const hasCert = await page.getByText(/sertifika|tebrik|indir/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmpty = await page.getByText(/henüz|bulunamadı|kazanılmış/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasCert || hasEmpty).toBeTruthy()
  })
})
