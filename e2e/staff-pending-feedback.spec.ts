import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Staff /staff/feedback (bekleyen geri bildirimler) sayfası E2E.
 *
 * Sprint A — yeni eklenen sayfa. DB durumuna bağlı olarak liste boş veya
 * dolu olabilir; test her iki durumu da kabul eder, sadece sayfa render +
 * endpoint çalışıyor mu doğrular.
 */

test.describe('Staff Geri Bildirim — Bekleyen Liste', () => {
  test('staff feedback sayfası açılır ve başlık görünür', async ({ page }) => {
    await login(page, 'staff')

    await page.goto('/staff/feedback')
    await expect(
      page.getByRole('heading', { name: /Bekleyen Geri Bildirimler/i }),
    ).toBeVisible({ timeout: 15000 })
  })

  test('sidebar\'da "Geri Bildirimler" linki çalışır', async ({ page }) => {
    await login(page, 'staff')

    await page.goto('/staff/dashboard')
    const link = page.getByRole('link', { name: /Geri Bildirimler/i }).first()
    await expect(link).toBeVisible({ timeout: 10000 })
    await link.click()
    await page.waitForURL('**/staff/feedback', { timeout: 10000 })
  })

  test('staff feedback pending endpoint çalışır', async ({ request, page }) => {
    await login(page, 'staff')

    const response = await request.get('/api/staff/feedback/pending')
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const body = await response.json()
      expect(body).toHaveProperty('items')
      expect(body).toHaveProperty('formActive')
      expect(Array.isArray(body.items)).toBe(true)
    }
  })

  test('boş durumda veya formsuz durumda hata vermez', async ({ page }) => {
    await login(page, 'staff')
    await page.goto('/staff/feedback')

    // Üç olası durumdan biri görünmeli:
    //  1. Boş durum (Inbox + "Bekleyen geri bildiriminiz yok")
    //  2. Form yapılandırılmamış (info banner)
    //  3. Liste (ZORUNLU veya ÖNERİLEN section)
    const empty = page.getByText(/Bekleyen geri bildiriminiz yok/i)
    const noForm = page.getByText(/Geri bildirim formu yapılandırılmamış/i)
    const sectionMandatory = page.getByText(/^ZORUNLU/)
    const sectionOptional = page.getByText(/^ÖNERİLEN/)

    await expect(empty.or(noForm).or(sectionMandatory).or(sectionOptional)).toBeVisible({ timeout: 15000 })
  })
})
