import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { aiApproveSchema } from '@/lib/validations'
import { copyObject, getDownloadUrl } from '@/lib/s3'

function mapArtifactToContentType(artifactType: string): string {
  const map: Record<string, string> = {
    audio: 'audio',
    video: 'video',
    slide_deck: 'pdf',
    quiz: 'quiz',
    flashcards: 'flashcards',
    report: 'report',
    infographic: 'infographic',
    data_table: 'data_table',
    mind_map: 'mind_map',
  }
  return map[artifactType] ?? artifactType
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError
  const orgId = dbUser!.organizationId!
  const { jobId } = await params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = aiApproveSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)

  const generation = await prisma.aiGeneration.findFirst({
    where: { id: jobId, organizationId: orgId },
  })

  if (!generation) return errorResponse('Üretim bulunamadı', 404)

  if (generation.evaluation !== 'approved') {
    return errorResponse('İçerik önce onaylanmalıdır', 403)
  }

  if (generation.savedToLibrary === true) {
    return errorResponse('Bu içerik zaten kütüphanede', 409)
  }

  if (generation.status !== 'completed') {
    return errorResponse('İçerik henüz tamamlanmadı', 400)
  }

  if (!generation.outputS3Key) {
    return errorResponse('İçerik dosyası bulunamadı', 400)
  }

  try {
    const ext = generation.outputFileType || 'bin'
    const destKey = `content-library/ai/${orgId}/${jobId}.${ext}`
    await copyObject(generation.outputS3Key!, destKey)

    const thumbnailUrl = generation.artifactType === 'infographic' && generation.outputS3Key
      ? await getDownloadUrl(destKey)
      : null

    const result = await prisma.$transaction(async (tx) => {
      const contentLibrary = await tx.contentLibrary.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description || null,
          category: parsed.data.category,
          difficulty: parsed.data.difficulty,
          targetRoles: parsed.data.targetRoles,
          duration: parsed.data.duration,
          smgPoints: parsed.data.smgPoints,
          thumbnailUrl,
          isActive: true,
          createdById: dbUser!.id,
          s3Key: destKey,
          contentType: mapArtifactToContentType(generation.artifactType),
          fileType: ext,
          contentData: generation.contentData ?? undefined,
          organizationId: orgId,
        },
      })

      await tx.aiGeneration.update({
        where: { id: jobId },
        data: {
          savedToLibrary: true,
          contentLibraryId: contentLibrary.id,
          savedAt: new Date(),
        },
      })

      return contentLibrary
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'ai_generation_save_to_library',
      entityType: 'ContentLibrary',
      entityId: result.id,
      newData: { title: parsed.data.title, category: parsed.data.category, fromAiGeneration: jobId },
    })

    logger.info('AI Content Studio', 'AI generation saved to library', { jobId, contentLibraryId: result.id })

    return jsonResponse({
      contentLibraryId: result.id,
      title: result.title,
      category: result.category,
      message: 'İçerik kütüphaneye eklendi',
    }, 201)
  } catch (err) {
    logger.error('AI Content Studio', 'Failed to save AI generation to library', { jobId, error: err })
    return errorResponse('Kütüphaneye kaydetme sırasında bir hata oluştu', 500)
  }
}
