import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Personel eğitim akışında çıkış/yeniden giriş kenar durumları.
 *
 * Bu testler production-benzeri seed üzerinde dolaşır — yeni kayıt OLUŞTURMAZ.
 * Aktif/atanmış bir eğitim varsa gerçek davranış doğrulanır; yoksa empty state
 * kabul edilir (CLAUDE.md e2e deseni: ortam-bağımlı, koşullu smoke).
 *
 * Kapsam:
 *  - Video/sınav sayfaları sonsuz spinner'a düşmeden render oluyor mu?
 *  - Derin link (doğrudan /exam/[id]/post-exam) çökmeden ele alınıyor mu?
 *  - F-1: aynı sınav ikinci sekmede açılınca "başka sekmede açık" kilidi devreye giriyor mu?
 */

/** Staff my-trainings'ten eğitim akışına girer; akışa girilemezse null döner. */
async function enterTrainingFlow(page: Page): Promise<string | null> {
  await page.goto('/staff/my-trainings', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')

  const startLink = page.getByRole('link', { name: /başla|devam|sınava|izle/i }).first()
  if (!(await startLink.isVisible({ timeout: 5000 }).catch(() => false))) return null

  await startLink.click()
  await page.waitForLoadState('networkidle')
  return page.url()
}

test.describe.serial('Sınav: çıkış/yeniden giriş kenar durumları', () => {
  test('video/sınav sayfası sonsuz spinner olmadan render olur', async ({ page }) => {
    await login(page, 'staff')
    const url = await enterTrainingFlow(page)
    test.skip(!url, 'Atanmış aktif eğitim yok — seed bağımlı senaryo atlandı')

    // Sayfa gerçek içerik göstermeli; sadece yükleniyor spinner'ında takılı kalmamalı.
    await expect(page.locator('body')).not.toBeEmpty()
    await page.waitForTimeout(2500)
    const stillLoadingOnly = await page
      .getByText(/^yükleniyor…?$/i)
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false)
    expect(stillLoadingOnly).toBeFalsy()
  })

  test('derin link: doğrudan post-exam URL çökmeden ele alınır', async ({ page }) => {
    await login(page, 'staff')
    const url = await enterTrainingFlow(page)
    test.skip(!url, 'Atanmış aktif eğitim yok — seed bağımlı senaryo atlandı')

    const match = url!.match(/\/exam\/([^/]+)\//)
    test.skip(!match, 'Exam akışına girilemedi — derin link senaryosu atlandı')

    // attemptPhaseRedirect doğru faza yönlendirmeli; sayfa 500/boş ekran vermemeli.
    const res = await page.goto(`/exam/${match![1]}/post-exam`, { waitUntil: 'domcontentloaded' })
    expect(res?.status() ?? 0).toBeLessThan(500)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('F-1: aynı sınav ikinci sekmede açılınca kilitlenir', async ({ page, context }) => {
    await login(page, 'staff')
    const url = await enterTrainingFlow(page)
    test.skip(!url, 'Atanmış aktif eğitim yok — seed bağımlı senaryo atlandı')
    test.skip(!/\/exam\/[^/]+\/(pre-exam|post-exam)/.test(url!), 'Sınav fazına girilemedi — tab-lock senaryosu atlandı')

    // İlk sekme sınava sahip; ikinci sekme aynı URL'i açınca bloklanmalı.
    const secondTab = await context.newPage()
    await secondTab.goto(url!, { waitUntil: 'domcontentloaded' })
    await secondTab.waitForLoadState('networkidle')

    const blocked = await secondTab
      .getByText(/başka bir sekmede açık/i)
      .isVisible({ timeout: 8000 })
      .catch(() => false)
    expect(blocked).toBeTruthy()
    await secondTab.close()
  })
})
