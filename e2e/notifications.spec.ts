/**
 * Bildirim Sistemi — E2E
 *
 * Mayıs 2026'da yapılan düzeltmelerin regresyonunu önler:
 *   1) Staff `SYSTEM_TYPES` filtresi kaldırıldı — `exam_passed/exam_failed/
 *      training_assigned/exam_started` artık staff'a görünür olmalı.
 *   2) `unreadCount` matematiksel olarak liste ile aynı tipleri sayar
 *      (bell badge ile sayfa içeriği uyumlu).
 *   3) Admin bildirim listesinde `relatedTrainingId` varsa "Eğitime git"
 *      deep link'i çıkmalı ve /admin/trainings/[id]'e götürmeli.
 *
 * Test'ler API-driven: seed kaydı oluşturup UI'da görünmesini doğruluyoruz.
 * Bu, gerçek kullanıcı akışına (eğitim ata → sınava gir → geç) güvenmek
 * yerine deterministik bir kapı bırakır.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import { login } from './helpers/auth'

const ENV_READY = !!process.env.E2E_ADMIN_EMAIL && !!process.env.E2E_STAFF_EMAIL

test.describe('Bildirim Sistemi', () => {
  test.skip(!ENV_READY, 'E2E credentials yok — .env.local kontrol et')

  test('Staff: sistem bildirim tipleri (exam_passed) bildirim merkezinde görünür', async ({ page, request }) => {
    // 1) Önce admin olarak login ol → staff kullanıcısının ID'sini ve org'unu al
    await login(page, 'admin')
    const staffInfo = await fetchFirstStaffViaApi(request)
    test.skip(!staffInfo, 'Hastanede staff kullanıcısı yok — seed gerekli')
    if (!staffInfo) return

    // 2) Admin API ile staff'a exam_passed bildirimi oluştur
    //    (kullanıcı sınavdan geçtiğinde sistem'in ürettiği tipi simüle et)
    const createRes = await request.post('/api/admin/notifications', {
      data: {
        userId: staffInfo.id,
        title: 'E2E — Sınavı geçtin',
        message: 'Bu bildirim Playwright tarafından test için oluşturuldu.',
        type: 'exam_passed',
      },
    })
    expect(createRes.ok(), `bildirim oluşturulamadı: ${createRes.status()}`).toBeTruthy()

    // 3) Staff olarak login ol ve bildirim sayfasını aç
    await page.context().clearCookies()
    await login(page, 'staff')
    await page.goto('/staff/notifications')
    await page.waitForLoadState('networkidle')

    // 4) Eski davranış: bu tip SYSTEM_TYPES filtresinde gizleniyordu, sayfada görünmezdi.
    //    Yeni davranış: helper'dan "SINAV GEÇTİ" kicker'ı ile görünür olmalı.
    const card = page.locator('text=E2E — Sınavı geçtin').first()
    await expect(card).toBeVisible({ timeout: 10000 })

    // Kicker label kontrolü — `getNotificationTypeMeta('exam_passed').label`
    const kicker = page.locator('text=SINAV GEÇTİ').first()
    await expect(kicker).toBeVisible({ timeout: 5000 })
  })

  test('Staff: bell unreadCount listedeki kayıt sayısıyla matematiksel olarak tutarlı', async ({ page, request }) => {
    // Eski bug: `unreadCount` SYSTEM_TYPES filtresi uygulamıyordu → bell "5 yeni" diyor,
    // sayfa 2 görüyor, kalan 3 okunamadığı için badge inatla kalıyordu.
    // Bu test her iki sorgunun aynı tipi saydığını garanti eder.

    await login(page, 'staff')

    const res = await request.get('/api/staff/notifications')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()

    expect(body).toHaveProperty('notifications')
    expect(body).toHaveProperty('unreadCount')

    const listUnreadCount = (body.notifications as Array<{ isRead: boolean }>).filter(
      (n) => !n.isRead,
    ).length

    // Liste max 50 ile sınırlandığı için, eşitlik yalnızca toplam < 50 ise
    // garanti edilebilir. Aşırı yüklü kullanıcıda count >= listedeki olabilir.
    if (body.notifications.length < 50) {
      expect(body.unreadCount).toBe(listUnreadCount)
    } else {
      // 50+ olduğunda en azından "bell sayısı >= listedeki unread sayısı"
      expect(body.unreadCount).toBeGreaterThanOrEqual(listUnreadCount)
    }
  })

  test('Admin: relatedTrainingId olan bildirimde "Eğitime git" linki doğru URL\'e gider', async ({ page, request }) => {
    await login(page, 'admin')

    // Mevcut bir eğitimi al (varsa)
    const trainingsRes = await request.get('/api/admin/trainings?page=1&limit=1')
    test.skip(!trainingsRes.ok(), 'Eğitim API erişilemiyor')
    const trainings = await trainingsRes.json()
    const trainingId = trainings?.trainings?.[0]?.id ?? trainings?.data?.[0]?.id
    test.skip(!trainingId, 'Hastanede eğitim yok — seed gerekli')

    const adminInfo = await fetchSelfViaApi(request)
    test.skip(!adminInfo, 'Auth bilgisi çekilemedi')
    if (!adminInfo || !trainingId) return

    // Admin'in kendisine related_training_id'li bir bildirim aç
    const createRes = await request.post('/api/admin/notifications', {
      data: {
        userId: adminInfo.id,
        title: 'E2E — Eğitime git testi',
        message: 'Bu bildirimden ilgili eğitime gidilebilmeli.',
        type: 'training_assigned',
        relatedTrainingId: trainingId,
      },
    })
    expect(createRes.ok(), `bildirim oluşturulamadı: ${createRes.status()}`).toBeTruthy()

    await page.goto('/admin/notifications')
    await page.waitForLoadState('networkidle')

    // Kart'taki "Eğitime git" link'i doğru href'e işaret etmeli
    const goLink = page
      .locator('a', { hasText: 'Eğitime git' })
      .filter({ has: page.locator(`text=`) })
      .first()
    await expect(goLink).toBeVisible({ timeout: 10000 })
    const href = await goLink.getAttribute('href')
    expect(href).toBe(`/admin/trainings/${trainingId}`)
  })
})

// ── Yardımcılar ─────────────────────────────────────────────────────────

async function fetchFirstStaffViaApi(
  request: APIRequestContext,
): Promise<{ id: string } | null> {
  const res = await request.get('/api/admin/staff?page=1&limit=1')
  if (!res.ok()) return null
  const body = await res.json().catch(() => null)
  if (!body) return null
  const list =
    (body.staff as Array<{ id: string }> | undefined) ??
    (body.users as Array<{ id: string }> | undefined) ??
    (body.data as Array<{ id: string }> | undefined) ??
    (Array.isArray(body) ? (body as Array<{ id: string }>) : null)
  return list?.[0] ? { id: list[0].id } : null
}

async function fetchSelfViaApi(
  request: APIRequestContext,
): Promise<{ id: string } | null> {
  const res = await request.get('/api/auth/me')
  if (!res.ok()) return null
  const body = await res.json().catch(() => null)
  if (!body) return null
  // /api/auth/me dönüş şekli proje'de "user.id" şeklinde
  return body?.user?.id ? { id: body.user.id } : body?.id ? { id: body.id } : null
}
