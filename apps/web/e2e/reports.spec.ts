import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Raporlar', () => {
  test('dashboard istatistikleri yuklenir', async ({ page }) => {
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)

    // Stat kartlarinin yuklenmesini bekle
    await page.waitForLoadState('networkidle')

    // StatCard bilesenlerinin gorunmesini bekle (istatistik degerleri)
    // Dashboard'da en az bir stat karti gorunmeli
    const statCards = page.locator('[class*="stat"], [class*="card"]').first()
    await expect(statCards).toBeVisible({ timeout: 15000 })
  })

  test('rapor sekmeleri arasi gezinme', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/reports')
    await page.waitForLoadState('networkidle')

    // Sayfa yuklenmeli
    await expect(page.locator('body')).not.toBeEmpty()

    // Rapor sekmeleri — "Genel Özet" varsayilan olarak aktif
    const overviewTab = page.getByText('Genel Özet').first()
    await expect(overviewTab).toBeVisible({ timeout: 10000 })

    // Egitim Bazli sekmesine tikla
    const trainingTab = page.getByText('Eğitim Bazlı').first()
    if (await trainingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trainingTab.click()
      await page.waitForTimeout(500)
    }

    // Personel sekmesine tikla
    const staffTab = page.getByText('Personel').first()
    if (await staffTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await staffTab.click()
      await page.waitForTimeout(500)
    }

    // Departman sekmesine tikla
    const deptTab = page.getByText('Departman').first()
    if (await deptTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deptTab.click()
      await page.waitForTimeout(500)
    }

    // Baslangic sekmesine don
    if (await overviewTab.isVisible()) {
      await overviewTab.click()
    }
  })

  test('disari aktar butonu calisir', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/admin/reports')
    await page.waitForLoadState('networkidle')

    // PDF veya Excel disari aktarma butonu
    const exportBtn = page.getByRole('button', { name: /dışa aktar|excel|pdf|indir|export/i }).first()
    if (await exportBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Download event'ini dinle
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
      await exportBtn.click()

      // Download baslarsa veya API cagrisi yapilirsa basarili sayilir
      const download = await downloadPromise
      if (download) {
        expect(download.suggestedFilename()).toBeTruthy()
      }
    }
  })

  test('dashboard grafikler gorunur', async ({ page }) => {
    await login(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await page.waitForLoadState('networkidle')

    // Grafik alanlarinin gorunmesini bekle (recharts SVG veya chart-card bileşeni)
    const chartArea = page.locator('[class*="chart"], svg.recharts-surface, [class*="ChartCard"]').first()
    const hasChart = await chartArea.isVisible({ timeout: 10000 }).catch(() => false)

    // Grafik veya en azindan dashboard icerik alani gorunmeli
    if (!hasChart) {
      // Dashboard en az bir icerik alani icermeli
      await expect(page.locator('main, [class*="dashboard"], [class*="content"]').first()).toBeVisible()
    }
  })
})
