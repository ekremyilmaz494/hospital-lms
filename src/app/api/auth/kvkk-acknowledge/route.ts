import { getAuthUser, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/kvkk-acknowledge
 *
 * KVKK Aydınlatma Metni'nin okunduğunu kaydeder.
 * Kurul 2020/404 uyarınca bu işlem giriş akışını bloklamaz —
 * kullanıcı isteğe bağlı olarak "Okudum, Anladım" der.
 */
export async function POST() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  // Idempotency kontrolünü rate limit'ten ÖNCE yap — DB zaten ack'lıysa no-op dön.
  // Aksi halde kullanıcı başarısız bir refresh/race-condition sonrası tekrar denerken
  // 429'a takılıp KVKK modalında kilitlenir (user_metadata JWT ile DB arasında desync).
  if (dbUser!.kvkkNoticeAcknowledgedAt) {
    // Metadata senkronizasyonu JWT ile DB arasında drift olmuş olabilir → refresh zorla
    try {
      const supabase = await createClient()
      await supabase.auth.updateUser({
        data: { kvkk_notice_acknowledged_at: dbUser!.kvkkNoticeAcknowledgedAt.toISOString() },
      })
      await supabase.auth.refreshSession()
    } catch {}
    return jsonResponse({ acknowledged: true, alreadySet: true })
  }

  // Spam önleme: 1 saat içinde en fazla 3 kez (sadece gerçek yeni onaylar için).
  // Dev'de atla — test sırasında "429 locked out" → KVKK modal loop'una düşülmesin.
  if (process.env.NODE_ENV === 'production') {
    const allowed = await checkRateLimit(`kvkk-acknowledge:${dbUser!.id}`, 3, 3600)
    if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)
  }

  const acknowledgedAt = new Date()

  await prisma.user.update({
    where: { id: dbUser!.id },
    data: { kvkkNoticeAcknowledgedAt: acknowledgedAt },
  })

  // JWT user_metadata'yı da güncelle — middleware bu alanı JWT'den okuyarak
  // KVKK guard'ı enforce eder. DB-only yazarsak kullanıcı her refresh'te
  // tekrar modal görür ve middleware refresh sonrası kontrol yapamaz.
  //
  // KRİTİK: updateUser() Supabase server-side metadata'yı günceller AMA cookie'deki
  // JWT'yi otomatik yenilemez. Sonrasında refreshSession() çağırarak yeni JWT'yi
  // force-refresh edip cookie'ye yazdırıyoruz. Yoksa kullanıcı /staff/dashboard'a
  // yönlendirildiğinde middleware hâlâ eski JWT'yi okuyup tekrar modala atıyor.
  try {
    const supabase = await createClient()
    await supabase.auth.updateUser({
      data: { kvkk_notice_acknowledged_at: acknowledgedAt.toISOString() },
    })
    // Yeni metadata ile JWT refresh → cookie'ye yeni access_token yazılır
    await supabase.auth.refreshSession()
  } catch (err) {
    logger.warn('auth:kvkk', 'user_metadata senkronizasyonu basarisiz', err)
    // DB yazıldı → akış devam etsin; sonraki login'de metadata zaten yenilenir
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId ?? undefined,
    action: 'KVKK_NOTICE_ACKNOWLEDGED',
    entityType: 'user',
    entityId: dbUser!.id,
    newData: { kvkkNoticeAcknowledgedAt: acknowledgedAt.toISOString() },
  })

  return jsonResponse({ acknowledged: true })
}
