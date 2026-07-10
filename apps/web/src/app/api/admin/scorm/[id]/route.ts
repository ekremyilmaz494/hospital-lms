import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { deletePrefix } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/admin/scorm/[id] — bir SCORM eğitimini kaldırır.
 * Soft-delete (isActive:false, arşiv) — sertifikalar/attempt'ler ve rapor verisi
 * korunur (mevcut training delete deseni). Ek olarak S3 içeriği (`scorm/{org}/{id}/`)
 * temizlenir: sertifikalar ScormAttempt'e (DB) bağlıdır, içerik dosyalarına DEĞİL.
 */
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`scorm-delete:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const training = await prisma.training.findFirst({
    where: { id, organizationId, category: 'scorm' },
    select: { id: true, title: true },
  })
  if (!training) return errorResponse('SCORM eğitimi bulunamadı', 404)

  await prisma.training.update({
    where: { id, organizationId },
    data: { isActive: false, publishStatus: 'archived' },
  })

  // İçerik dosyalarını sil (best-effort — soft-delete zaten yeni başlatmayı engeller).
  await deletePrefix(`scorm/${organizationId}/${id}/`)

  await audit({
    action: 'scorm_delete',
    entityType: 'training',
    entityId: id,
    newData: { title: training.title },
  })

  logger.info('SCORM Delete', `SCORM eğitimi arşivlendi: ${training.title}`, { trainingId: id })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
