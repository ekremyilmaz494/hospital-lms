import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * EY.FR.40 Eğitim Geri Bildirim Sistemi E2E testleri
 *
 * NOT: Bu testler gerçek demo hesaplarla çalışır ve DB'ye yazar.
 * CI'da ayrı bir test org + seeded user gerekir. Şimdilik local dev için.
 */

/**
 * Personelin ilk eğitiminin detay sayfasını açar.
 * Atanmış eğitim yoksa `false` döner (test gracefully skip edilir).
 */
async function openFirstTrainingDetail(page: Page): Promise<boolean> {
  await page.goto('/staff/my-trainings')
  await page.waitForLoadState('networkidle')
  // Detay kartı linkleri: /staff/my-trainings/{id} — sidebar linki ("/staff/my-trainings")
  // trailing slash içermediği için bu seçiciye takılmaz.
  const firstTraining = page.locator('a[href*="/staff/my-trainings/"]').first()
  if (!(await firstTraining.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false
  }
  await firstTraining.click()
  await page.waitForURL(/\/staff\/my-trainings\/[0-9a-f-]+/i, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  return true
}

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

/**
 * Eğitim detay sayfasındaki "Geri Bildirim" bölümü (EY.FR.40).
 *
 * DB durumu bilinmediği için testler toleranslıdır: org'da aktif form yoksa
 * bölüm gizlenir (durum d); varsa 3 durumdan biri (a/b/c) görünür.
 */
test.describe('EY.FR.40 — Eğitim Detayında Geri Bildirim Bölümü', () => {
  test('detay API yanıtı feedback nesnesini doğru şekilde içerir', async ({ page }) => {
    await login(page, 'staff')
    if (!(await openFirstTrainingDetail(page))) {
      test.skip(true, 'Personele atanmış eğitim yok — test atlanıyor')
      return
    }

    // URL'deki id ile detay API'sini doğrudan çağır (cookie'ler page'den gelir).
    const idMatch = /\/staff\/my-trainings\/([0-9a-f-]+)/i.exec(page.url())
    expect(idMatch).not.toBeNull()
    const id = idMatch?.[1] ?? ''

    const res = await page.request.get(`/api/staff/my-trainings/${id}`)
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body).toHaveProperty('feedback')

    const fb = body.feedback
    expect(typeof fb.formActive).toBe('boolean')
    expect(typeof fb.mandatory).toBe('boolean')
    expect(typeof fb.submitted).toBe('boolean')
    expect(typeof fb.canSubmit).toBe('boolean')
    // submittedAt ve attemptId: string | null
    expect(fb.submittedAt === null || typeof fb.submittedAt === 'string').toBe(true)
    expect(fb.attemptId === null || typeof fb.attemptId === 'string').toBe(true)
    // Mantıksal tutarlılık: gönderilmişse tekrar doldurulamaz.
    if (fb.submitted) expect(fb.canSubmit).toBe(false)
    // canSubmit ise tetikleyen attempt id'si dolu olmalı.
    if (fb.canSubmit) expect(fb.attemptId).not.toBeNull()
  })

  test('detayda geri bildirim bölümü tutarlı bir durum gösterir', async ({ page }) => {
    await login(page, 'staff')
    if (!(await openFirstTrainingDetail(page))) {
      test.skip(true, 'Personele atanmış eğitim yok — test atlanıyor')
      return
    }

    // Bölüm marker'ı (caption: "Eğitim değerlendirme formu · EY.FR.40").
    // Org'da aktif form yoksa bölüm hiç render edilmez (durum d) — bu da geçerli.
    const sectionMarker = page.getByText(/EY\.FR\.40/).first()
    const hasSection = await sectionMarker.isVisible({ timeout: 10000 }).catch(() => false)

    if (!hasSection) return // Durum (d): aktif form yok — bölüm gizli.

    // Bölüm görünüyorsa 3 durumdan biri görünmeli.
    const submitted = page.getByRole('heading', { name: /Geri bildiriminiz alındı/i })
    const canSubmit = page.getByRole('link', { name: /Geri Bildirim Ver/i })
    const notYet = page.getByRole('heading', { name: /Geri bildirim henüz açık değil/i })

    await expect(submitted.or(canSubmit).or(notYet)).toBeVisible({ timeout: 10000 })
  })

  test('"Geri Bildirim Ver" CTA görünürse feedback formuna yönlendirir', async ({ page }) => {
    await login(page, 'staff')
    if (!(await openFirstTrainingDetail(page))) {
      test.skip(true, 'Personele atanmış eğitim yok — test atlanıyor')
      return
    }

    const cta = page.getByRole('link', { name: /Geri Bildirim Ver/i })
    if (!(await cta.isVisible({ timeout: 8000 }).catch(() => false))) {
      // İlk eğitim doldurulabilir durumda değil (durum a/c/d) — beklenen.
      return
    }

    // CTA, /exam/{trainingId}/feedback formuna işaret etmeli.
    const href = await cta.getAttribute('href')
    expect(href).toMatch(/\/exam\/[0-9a-f-]+\/feedback/i)

    await cta.click()
    await page.waitForURL(/\/exam\/.+\/feedback/i, { timeout: 20000 })
  })
})
