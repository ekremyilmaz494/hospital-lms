import { getAuthUser, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { prisma } from '@/lib/prisma'

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

  // Spam önleme: 1 saat içinde en fazla 3 kez
  const allowed = await checkRateLimit(`kvkk-acknowledge:${dbUser!.id}`, 3, 3600)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  // Zaten onayladıysa tekrar yazmaya gerek yok
  if (dbUser!.kvkkNoticeAcknowledgedAt) {
    return jsonResponse({ acknowledged: true, alreadySet: true })
  }

  const acknowledgedAt = new Date()

  await prisma.user.update({
    where: { id: dbUser!.id },
    data: { kvkkNoticeAcknowledgedAt: acknowledgedAt },
  })

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
