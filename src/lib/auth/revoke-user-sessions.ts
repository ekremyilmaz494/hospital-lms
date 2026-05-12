import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Bir kullanıcının tüm aktif oturumlarını ve "güvenilir cihaz" kayıtlarını iptal eder.
 *
 * Admin/super_admin "Şifre Sıfırla" akışından SONRA çağrılması ZORUNLU. Aksi halde:
 *   - Supabase `auth.admin.updateUserById({ password })` sadece parola hash'ini günceller,
 *     mevcut refresh token'ları (default 60 gün TTL) yaşamaya devam eder.
 *   - Eski parolayla zaten giriş yapmış kullanıcı oturumunu korur → yeni parola "etkisiz".
 *   - SMS MFA atlamasını sağlayan trusted_device kaydı da hâlâ geçerli sayılır.
 *
 * Davranış:
 *   1. GoTrue admin REST: DELETE /auth/v1/admin/users/{id}/sessions
 *      → tüm refresh token'lar invalide. Access token'lar TTL (~1s) dolana kadar yaşar
 *      ama refresh edilemediği için pratikte oturum öldü.
 *   2. trusted_devices.revokedAt = now() (hepsi) — KVKK audit için hard delete yerine soft revoke.
 *
 * Best-effort: bir adım fail olursa diğeri yine çalışır; hata response'ı bloklamaz, loglanır.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      })
      if (!res.ok && res.status !== 404) {
        const body = await res.text().catch(() => '')
        logger.warn('revoke-user-sessions', 'GoTrue admin sessions DELETE basarisiz', {
          userId,
          status: res.status,
          body: body.slice(0, 200),
        })
      }
    } catch (err) {
      logger.warn('revoke-user-sessions', 'GoTrue admin sessions DELETE exception', {
        userId,
        error: err instanceof Error ? err.message : err,
      })
    }
  } else {
    logger.warn('revoke-user-sessions', 'Supabase env eksik — session revoke atlandi', { userId })
  }

  try {
    await prisma.trustedDevice.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  } catch (err) {
    logger.warn('revoke-user-sessions', 'trustedDevice revoke basarisiz', {
      userId,
      error: err instanceof Error ? err.message : err,
    })
  }
}
