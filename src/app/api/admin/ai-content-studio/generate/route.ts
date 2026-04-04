import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { startGeneration, AiServiceError } from '@/app/admin/ai-content-studio/lib/ai-service-client'
import { downloadAndSaveArtifact } from '@/app/admin/ai-content-studio/lib/download-helper'
import { aiGenerateSchema } from '@/lib/validations'

/**
 * POST /api/admin/ai-content-studio/generate
 *
 * AI içerik üretimi başlatır. Normal artifact'ler asenkron (task_id ile),
 * mind_map senkron (artifact_id ile) döner.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // Rate limit: 10 istek / saat / organizasyon
  const allowed = await checkRateLimit('ai-generate:' + orgId, 10, 3600)
  if (!allowed) {
    return errorResponse('Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.', 429)
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = aiGenerateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri')

  // Google hesap bağlantısı kontrolü
  const googleConnection = await prisma.aiGoogleConnection.findUnique({
    where: { organizationId: orgId },
  })
  if (!googleConnection || googleConnection.status !== 'connected') {
    return errorResponse('Google hesabı bağlı değil. Lütfen önce bağlantı kurun.', 403)
  }

  // Notebook varlık kontrolü
  const notebook = await prisma.aiNotebook.findFirst({
    where: { id: parsed.data.notebookId, organizationId: orgId },
  })
  if (!notebook) {
    return errorResponse('Notebook bulunamadı', 404)
  }

  // Üretim kaydı oluştur
  const generation = await prisma.aiGeneration.create({
    data: {
      organizationId: orgId,
      userId: dbUser!.id,
      notebookId: notebook.id,
      title: parsed.data.title,
      artifactType: parsed.data.artifactType,
      instructions: parsed.data.instructions,
      settings: (parsed.data.settings || {}) as Record<string, string>,
      status: 'queued',
      progress: 0,
    },
  })

  try {
    const result = await startGeneration({
      notebook_id: notebook.notebookLmId,
      artifact_type: parsed.data.artifactType,
      instructions: parsed.data.instructions || '',
      settings: parsed.data.settings,
    })

    if (result.task_id) {
      // Normal asenkron üretim
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { taskLmId: result.task_id, status: 'processing', progress: 10 },
      })
    } else if (result.artifact_id && result.status === 'completed') {
      // Mind map — senkron tamamlandı, indirme başlat
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { artifactLmId: result.artifact_id, status: 'downloading' },
      })

      // Fire-and-forget indirme
      downloadAndSaveArtifact({
        generationId: generation.id,
        notebookLmId: notebook.notebookLmId,
        artifactLmId: result.artifact_id!,
        artifactType: parsed.data.artifactType,
        organizationId: orgId,
        settings: parsed.data.settings as Record<string, string> | undefined,
      }).catch(() => {}) // Hata fonksiyon içinde yönetilir
    }

    // Google bağlantısı son kullanım zamanını güncelle
    await prisma.aiGoogleConnection.update({
      where: { organizationId: orgId },
      data: { lastUsedAt: new Date() },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'ai_generation_start',
      entityType: 'AiGeneration',
      entityId: generation.id,
    })

    return jsonResponse({
      jobId: generation.id,
      status: result.task_id ? 'processing' : 'downloading',
      artifactType: parsed.data.artifactType,
      title: parsed.data.title,
    }, 202)
  } catch (err) {
    logger.error('ai-generate', 'AI üretim servisi hatası', { generationId: generation.id, error: err })

    await prisma.aiGeneration.update({
      where: { id: generation.id },
      data: {
        status: 'failed',
        errorMessage: err instanceof AiServiceError ? err.message : 'Üretim servisiyle iletişim kurulamadı',
      },
    })

    return errorResponse('AI üretim servisiyle iletişim kurulamadı. Lütfen daha sonra tekrar deneyin.', 502)
  }
}
