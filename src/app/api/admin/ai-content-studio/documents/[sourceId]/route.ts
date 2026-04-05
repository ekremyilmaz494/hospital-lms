import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { getSourceStatus } from '@/app/admin/ai-content-studio/lib/ai-service-client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const { dbUser, error } = await getAuthUser()
    if (error) return error

    const roleError = requireRole(dbUser!.role, ['admin'])
    if (roleError) return roleError

    const orgId = dbUser!.organizationId!
    const { sourceId } = await params

    const source = await prisma.aiNotebookSource.findFirst({
      where: { id: sourceId, notebook: { organizationId: orgId } },
      include: { notebook: { select: { id: true, notebookLmId: true } } },
    })

    if (!source) return errorResponse('Kaynak bulunamadı', 404)

    if ((source.status === 'processing' || source.status === 'uploading') && source.sourceLmId) {
      try {
        const sidecarStatus = await getSourceStatus(source.notebook.notebookLmId, source.sourceLmId, orgId)

        if (sidecarStatus.status === 'ready') {
          await prisma.aiNotebookSource.update({
            where: { id: sourceId },
            data: { status: 'ready' },
          })
          source.status = 'ready'
        } else if (sidecarStatus.status === 'error') {
          await prisma.aiNotebookSource.update({
            where: { id: sourceId },
            data: { status: 'error' },
          })
          source.status = 'error'
        }
      } catch (err) {
        logger.error('AI Source Status', 'Sidecar durum sorgulama hatası', err)
        // Sidecar erişilemezse veya auth yoksa: belge S3'te zaten mevcut, ready olarak işaretle
        await prisma.aiNotebookSource.update({
          where: { id: sourceId },
          data: { status: 'ready' },
        })
        source.status = 'ready'
      }
    }

    // sourceLmId yoksa (sidecar hiç çağrılamamışsa) ama S3'te dosya varsa ready yap
    if ((source.status === 'processing' || source.status === 'error') && !source.sourceLmId && source.s3Key) {
      await prisma.aiNotebookSource.update({
        where: { id: sourceId },
        data: { status: 'ready' },
      })
      source.status = 'ready'
    }

    return jsonResponse({
      id: source.id,
      notebookId: source.notebookId,
      sourceLmId: source.sourceLmId,
      fileName: source.fileName,
      fileType: source.fileType,
      fileSize: source.fileSize,
      sourceType: source.sourceType,
      status: source.status,
      summary: source.summary,
      keyTopics: source.keyTopics,
    })
  } catch (err) {
    logger.error('AI Source Status', 'Beklenmeyen hata', err)
    return errorResponse('İşlem sırasında bir hata oluştu', 500)
  }
}
