import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { deleteObject } from '@/lib/s3'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError
  const orgId = dbUser!.organizationId!

  const { jobId } = await params

  const generation = await prisma.aiGeneration.findFirst({
    where: { id: jobId, organizationId: orgId },
  })

  if (!generation) {
    return errorResponse('Üretim bulunamadı', 404)
  }

  if (generation.savedToLibrary === true) {
    return errorResponse(
      'Kütüphaneye kaydedilmiş içerik silinemez. Önce kütüphaneden kaldırın.',
      403
    )
  }

  if (generation.outputS3Key) {
    try {
      await deleteObject(generation.outputS3Key)
    } catch (err) {
      logger.error('AI Discard', 'S3 silme hatası', err)
    }
  }

  await prisma.aiGeneration.delete({ where: { id: jobId } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'ai_generation_discard',
    entityType: 'AiGeneration',
    entityId: jobId,
    newData: {
      title: generation.title,
      artifactType: generation.artifactType,
    },
  })

  return jsonResponse({ success: true, message: 'İçerik silindi' })
}
