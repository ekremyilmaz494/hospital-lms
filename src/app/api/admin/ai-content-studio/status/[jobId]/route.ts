import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getTaskStatus, AiServiceError } from '@/app/admin/ai-content-studio/lib/ai-service-client'
import { downloadAndSaveArtifact } from '@/app/admin/ai-content-studio/lib/download-helper'
import { logger } from '@/lib/logger'

const RESULT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio',
  mp4: 'video',
  pdf: 'presentation',
  pptx: 'presentation',
  json: 'json',
  png: 'image',
  csv: 'data',
  md: 'document',
}

/** Timeout threshold in milliseconds (45 minutes — ses/video uzun sürebilir) */
const GENERATION_TIMEOUT_MS = 45 * 60 * 1000

export async function GET(
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
    include: {
      notebook: {
        select: { notebookLmId: true },
      },
    },
  })

  if (!generation) {
    return errorResponse('Üretim bulunamadı', 404)
  }

  let currentStatus = generation.status
  let currentProgress = generation.progress
  let currentErrorMessage = generation.errorMessage

  // If already completed or failed, return current DB data directly
  if (currentStatus === 'completed' || currentStatus === 'failed') {
    return buildResponse(generation, currentStatus, currentProgress, currentErrorMessage)
  }

  // If queued, processing, or downloading (sidecar still working), poll sidecar for status
  if (['queued', 'processing', 'downloading'].includes(currentStatus) && generation.taskLmId) {
    try {
      const sidecarResult = await getTaskStatus(
        generation.notebook.notebookLmId,
        generation.taskLmId,
        orgId,
      )

      if (sidecarResult.status === 'completed') {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { artifactLmId: sidecarResult.artifact_id },
        })

        // Fire-and-forget download
        downloadAndSaveArtifact({
          generationId: generation.id,
          notebookLmId: generation.notebook.notebookLmId,
          artifactLmId: sidecarResult.artifact_id!,
          artifactType: generation.artifactType,
          organizationId: orgId,
          settings: (generation.settings as Record<string, string>) || {},
        }).catch(() => {})

        currentStatus = 'downloading'
        currentProgress = 90
      } else if (sidecarResult.status === 'downloading') {
        // NotebookLM üretimi tamamlandı, sidecar dosyayı indiriyor
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'downloading', progress: sidecarResult.progress },
        })

        currentStatus = 'downloading'
        currentProgress = sidecarResult.progress
      } else if (sidecarResult.status === 'failed') {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', errorMessage: sidecarResult.error },
        })

        currentStatus = 'failed'
        currentErrorMessage = sidecarResult.error || null
      } else if (sidecarResult.status === 'processing') {
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { progress: sidecarResult.progress },
        })

        currentProgress = sidecarResult.progress
      }
    } catch (err) {
      logger.error('ai-content-studio/status', 'Sidecar durum sorgusu başarısız', err)

      const age = Date.now() - new Date(generation.createdAt).getTime()
      const is404 = err instanceof AiServiceError && err.status === 404

      // Sidecar 404 = job store'da yok (restart sonrası kaybolmuş)
      // veya 15 dk timeout aşılmış — her iki durumda da failed yap
      if (is404 || age > GENERATION_TIMEOUT_MS) {
        const failMessage = is404
          ? 'Üretim servisi yeniden başlatıldı, üretim kayboldu. Lütfen tekrar deneyin.'
          : 'Üretim zaman aşımına uğradı'
        await prisma.aiGeneration.update({
          where: { id: generation.id },
          data: { status: 'failed', errorMessage: failMessage },
        })

        currentStatus = 'failed'
        currentErrorMessage = failMessage
      }
    }
  }

  return buildResponse(generation, currentStatus, currentProgress, currentErrorMessage)
}

function buildResponse(
  generation: {
    id: string
    title: string
    artifactType: string
    outputFileType: string | null
    errorMessage: string | null
    evaluation: string | null
    evaluationNote: string | null
    savedToLibrary: boolean
    createdAt: Date
  },
  status: string,
  progress: number,
  errorMessage: string | null
) {
  return jsonResponse({
    jobId: generation.id,
    title: generation.title,
    artifactType: generation.artifactType,
    status,
    progress,
    resultType: generation.outputFileType
      ? RESULT_TYPE_MAP[generation.outputFileType] || null
      : null,
    error: errorMessage,
    evaluation: generation.evaluation,
    evaluationNote: generation.evaluationNote,
    savedToLibrary: generation.savedToLibrary,
    createdAt: generation.createdAt,
  })
}
