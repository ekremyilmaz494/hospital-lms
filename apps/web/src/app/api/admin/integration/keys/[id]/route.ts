import { z } from 'zod/v4'
import { prisma } from '@/lib/prisma'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'

/**
 * İK/HBYS entegrasyonu — API anahtarı iptali (hospital-admin).
 *
 * DELETE → anahtarı REVOKE eder (hard delete DEĞİL — revokedAt=now).
 * Geçmiş SyncRun kayıtlarının apiKeyId izi korunur; revoke edilmiş anahtar
 * verifyApiKey'de reddedilir. Org-scope ZORUNLU — başka org'un anahtarı 404.
 */

// perf-check: no-cache-invalidation — anahtar listesi Redis'te cache'lenmiyor;
// keys GET'i yalnız HTTP Cache-Control (private, max-age=30) kullanır.
const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.'

const idSchema = z.string().uuid()

// DELETE /api/admin/integration/keys/[id] — anahtarı iptal et (revoke)
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const enabled = await checkFeature(organizationId, 'staffIntegration')
  if (!enabled) return errorResponse(FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`integration-key-revoke:${organizationId}`, 30, 3600)
  if (!allowed) {
    return errorResponse('Çok fazla iptal denemesi yapıldı. Lütfen daha sonra tekrar deneyin.', 429)
  }

  // Geçersiz UUID → Prisma cast hatasına düşmeden 404 (iç detay sızdırma).
  const parsedId = idSchema.safeParse(params.id)
  if (!parsedId.success) return errorResponse('Anahtar bulunamadı', 404)
  const keyId = parsedId.data

  // Cross-tenant koruması: id TEK BAŞINA yeterli değil — org filtresi ZORUNLU.
  const key = await prisma.integrationApiKey.findFirst({
    where: { id: keyId, organizationId },
    select: { id: true, name: true, keyPrefix: true, revokedAt: true },
  })
  if (!key) return errorResponse('Anahtar bulunamadı', 404)
  if (key.revokedAt !== null) {
    return errorResponse('Anahtar zaten iptal edilmiş', 409)
  }

  const revokedAt = new Date()
  // updateMany + org filtresi: findFirst ile update arasındaki yarışta bile
  // başka org'un kaydına yazılamaz (defense-in-depth); revokedAt guard'ı
  // eşzamanlı çifte revoke'u da idempotent kılar.
  const updated = await prisma.integrationApiKey.updateMany({
    where: { id: keyId, organizationId, revokedAt: null },
    data: { revokedAt },
  })
  if (updated.count === 0) {
    return errorResponse('Anahtar zaten iptal edilmiş', 409)
  }

  await audit({
    action: 'integration.key.revoke',
    entityType: 'integration_api_key',
    entityId: keyId,
    oldData: { name: key.name, keyPrefix: key.keyPrefix },
    newData: { revokedAt },
  })

  return jsonResponse({ id: keyId, revokedAt })
}, { requireOrganization: true })
