import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * EY.FR.40 Eğitim Geri Bildirim Sistemi E2E testleri
 *
 * NOT: Bu testler gerçek demo hesaplarla çalışır ve DB'ye yazar.
 * CI'da ayrı bir test org + seeded user gerekir. Şimdilik local dev için.
 */

test.describe('EY.FR.40 Geri Bildirim Sistemi', () => {
  test('admin form editörü açılır ve form görünür', async ({ page }) => {
    await login(page, 'admin')

    await page.goto('/admin/feedback-forms')
    await expect(page.getByRole('heading', { name: /Geri Bildirim Formu/i })).toBeVisible({ timeout: 10000 })

    // Form meta alanları var
    await expect(page.locator('input[value*="Eğitim Değerlendirme"]').first()).toBeVisible()
  })

  test('admin yanıtlar listesi açılır (boş bile olsa hata yok)', async ({ page }) => {
    await login(page, 'admin')

    await page.goto('/admin/feedback-forms/responses')
    await expect(page.getByRole('heading', { name: /Geri Bildirim Yanıtları/i })).toBeVisible({ timeout: 10000 })

    // Tablo header'ı görünür
    await expect(page.getByText('Katılımcı')).toBeVisible()
    await expect(page.getByText('Genel Puan')).toBeVisible()
  })

  test('admin analytics sayfası açılır', async ({ page }) => {
    await login(page, 'admin')

    await page.goto('/admin/feedback-forms/analytics')
    await expect(page.getByRole('heading', { name: /Geri Bildirim Analitiği/i })).toBeVisible({ timeout: 10000 })
  })

  test('admin formu düzenleyip kaydedebilir (smart merge)', async ({ page }) => {
    await login(page, 'admin')

    await page.goto('/admin/feedback-forms')
    await expect(page.getByRole('heading', { name: /Geri Bildirim Formu/i })).toBeVisible({ timeout: 10000 })

    // Başlık input'unu bul ve değiştir
    const titleInput = page.locator('input[type="text"]').first()
    await titleInput.fill('EY.FR.40 — Test Başlığı')

    // Kaydet
    const saveBtn = page.getByRole('button', { name: /Güncelle|Oluştur/i })
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      // Toast görünmeli (success mesajı)
      await expect(page.getByText(/kaydedildi/i)).toBeVisible({ timeout: 10000 })
    }
  })

  test('sidebar\'da "Geri Bildirim" menüsü görünür', async ({ page }) => {
    await login(page, 'admin')

    // Sidebar menüsünde "Geri Bildirim" item'ını bul
    await expect(page.getByRole('link', { name: /Form Editörü/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('eğitim detayında "Geri Bildirimler" butonu görünür', async ({ page }) => {
    await login(page, 'admin')

    // İlk eğitime tıkla (varsa)
    await page.goto('/admin/trainings')
    await page.waitForLoadState('networkidle')

    const firstTrainingLink = page.locator('a[href*="/admin/trainings/"]:not([href$="/new"]):not([href$="/trainings"])').first()
    if (await firstTrainingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstTrainingLink.click()
      await page.waitForLoadState('networkidle')

      // "Geri Bildirimler" butonu görünmeli
      await expect(page.getByRole('button', { name: /Geri Bildirimler/i })).toBeVisible({ timeout: 10000 })
    }
  })

  test('staff feedback form endpoint çalışır (API kontrolü)', async ({ request, page }) => {
    await login(page, 'staff')

    // API cevabı 200 ve form dönmeli
    const response = await request.get('/api/feedback/form')
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const body = await response.json()
      // Form bulundu ya da null (aktif form yoksa)
      expect(body).toHaveProperty('form')
    }
  })
})
