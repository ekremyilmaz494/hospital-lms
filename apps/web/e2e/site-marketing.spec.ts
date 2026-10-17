import { test, expect, type Page } from '@playwright/test'

/**
 * Pazarlama sitesi duman testi (oturum gerektirmez). Kapsam: her indekslenen sayfa
 * açılır, tek h1 + canonical taşır, mobilde yatay taşma yok; yönlendirme, 404,
 * JS kapalı içerik, SSS klavye erişimi ve çerez tercihi akışı.
 */

const PAGES = [
  '/', '/en', '/hakkimizda', '/demo', '/iletisim', '/sss', '/guvenlik',
  '/kvkk', '/privacy', '/terms', '/cerez-politikasi', '/data-retention',
]

async function skipBanner(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lms_cookie_consent', 'true')
    } catch {}
  })
}

test.describe('pazarlama sayfaları', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const path of PAGES) {
    test(`${path} açılır, tek h1, canonical, yatay taşma yok`, async ({ page }) => {
      await skipBanner(page)
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /klinovax\.com/)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test('/contact kalıcı olarak /iletisim’e yönlenir', async ({ request }) => {
  const res = await request.get('/contact', { maxRedirects: 0 })
  expect([301, 308]).toContain(res.status())
  expect(res.headers().location).toMatch(/\/iletisim$/)
})

// Listede olmayan kök yollar proxy'de fail-closed olarak login'e gider (site-routes.ts);
// markalı 404, public bir yolun altındaki bilinmeyen adreste görünür.
test('public yol altındaki bilinmeyen adres markalı 404 döner', async ({ page }) => {
  await skipBanner(page)
  const res = await page.goto('/hakkimizda/boyle-bir-sayfa-yok')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Sayfa bulunamadı/)
})

test.describe('JS kapalıyken', () => {
  test.use({ javaScriptEnabled: false })

  test('ana sayfa başlığı, CTA ve SSS içeriği okunur', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Demo Talep Edin' }).first()).toBeVisible()
    await expect(page.locator('#sss details').first()).toBeAttached()
  })
})

test('SSS klavyeyle açılır', async ({ page }) => {
  await skipBanner(page)
  await page.goto('/sss')
  const first = page.locator('main details').first()
  await first.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('open', '')
})

test('çerez tercihi: yalnız zorunlu seçilir, alt bilgiden yeniden açılır', async ({ page }) => {
  await page.goto('/')
  const banner = page.getByRole('dialog', { name: 'Çerez tercihleriniz' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Yalnız zorunlu' }).click()
  await expect(banner).toBeHidden()
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('lms_cookie_prefs') ?? '{}'))
  expect(prefs).toMatchObject({ analytics: false, functional: false })

  await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
  await expect(banner).toBeVisible()
  await expect(banner.getByRole('switch', { name: 'İstatistik' })).toHaveAttribute('aria-checked', 'false')
})
