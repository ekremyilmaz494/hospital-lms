/**
 * DELETE /api/admin/ai-content-studio/[id] — generation sil (DB + S3).
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { deleteObject } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`ai-delete:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla silme isteği.', 429)

  const gen = await prisma.aiGeneration.findFirst({
    where: { id, organizationId },
    select: { id: true, s3Key: true, sourceFiles: true, artifactType: true },
  })
  if (!gen) return errorResponse('Üretim bulunamadı.', 404)

  // S3'ten output sil
  if (gen.s3Key) {
    try {
      await deleteObject(gen.s3Key)
    } catch (err) {
      logger.warn('AI Studio', 'S3 output delete failed', { err: String(err), key: gen.s3Key })
    }
  }

  // S3'ten kaynak dosyaları sil
  const sources = gen.sourceFiles as Array<{ s3Key: string }> | null
  if (Array.isArray(sources)) {
    await Promise.all(
      sources.map((sf) =>
        deleteObject(sf.s3Key).catch((err) =>
          logger.warn('AI Studio', 'S3 source delete failed', { err: String(err), key: sf.s3Key }),
        ),
      ),
    )
  }

  await prisma.aiGeneration.delete({ where: { id } })

  await audit({
    action: 'ai_generation_delete',
    entityType: 'ai_generation',
    entityId: id,
    oldData: { artifactType: gen.artifactType },
  })

  return jsonResponse({ ok: true })
}, { requireOrganization: true })
