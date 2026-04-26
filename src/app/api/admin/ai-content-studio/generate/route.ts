/**
 * Generation başlat — Hospital LMS tarafı koordinatörü.
 *
 * 1. AiGeneration row yarat (status=pending, jobId=null)
 * 2. Worker için S3 presigned PUT URL üret (output dosyası için)
 * 3. Worker için kaynak dosyalar için presigned GET URL'leri üret
 * 4. Worker'a forward et (startGeneration)
 * 5. Worker jobId döner → DB'ye yaz (status=processing)
 * 6. 202 + generationId döndür → client polling'e başlar
 */
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { getUploadUrl, getDownloadUrl, aiArtifactKey } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { aiGenerateSchema } from '@/lib/ai-content-studio/validations'
import {
  ARTIFACT_TYPE_TO_CLI,
  ARTIFACT_TYPE_TO_EXT,
  ARTIFACT_TYPE_TO_MIME,
  ARTIFACT_OPTIONS_DEFAULTS,
  AI_GEN_RATE_LIMIT_PER_HOUR,
} from '@/lib/ai-content-studio/constants'
import { startGeneration } from '@/lib/ai-content-studio/notebook-worker'

export const maxDuration = 60

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // Org-bazlı rate limit (kullanıcı değil — abuse önleme)
  const allowed = await checkRateLimit(`ai-gen:${orgId}`, AI_GEN_RATE_LIMIT_PER_HOUR, 3600)
  if (!allowed) {
    return errorResponse('Saatlik üretim limiti aşıldı. Lütfen bir saat bekleyin.', 429)
  }

  // Klinova shared session kullanılıyor — per-org hesap bağlama gerekmez.
  // Worker shared storage_state'i yoksa job runtime'da fail eder, UI o zaman
  // "Klinova AI bakımda" mesajı gösterir.

  const body = await parseBody(request)
  const parsed = aiGenerateSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz istek.', 400)
  }
  const data = parsed.data

  // Multi-tenant guard: yüklenen sourceFiles s3Key'i gerçekten bu org'a ait mi?
  for (const sf of data.sourceFiles) {
    if (!sf.s3Key.startsWith(`ai-content/${orgId}/`)) {
      return errorResponse('Geçersiz kaynak dosya referansı.', 403)
    }
  }

  // Default options'ı doldur (UI eksik gönderirse)
  const defaultOpts = ARTIFACT_OPTIONS_DEFAULTS[data.artifactType]
  const finalOptions = { ...defaultOpts, ...data.options }

  const ext = ARTIFACT_TYPE_TO_EXT[data.artifactType]
  const mime = ARTIFACT_TYPE_TO_MIME[data.artifactType]
  const cliType = ARTIFACT_TYPE_TO_CLI[data.artifactType]

  // 1. AiGeneration yarat
  const gen = await prisma.aiGeneration.create({
    data: {
      organizationId: orgId,
      createdById: dbUser!.id,
      artifactType: data.artifactType,
      prompt: data.prompt ?? null,
      sourceFiles: data.sourceFiles,
      sourceUrls: data.sourceUrls,
      options: finalOptions,
      status: 'pending',
    },
    select: { id: true },
  })

  // 2. Output S3 key + presigned PUT URL
  const outputKey = aiArtifactKey(orgId, gen.id, ext)
  let uploadUrl: string
  try {
    uploadUrl = await getUploadUrl(outputKey, mime)
  } catch (err) {
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: { status: 'failed', errorMessage: 'Output S3 URL alınamadı', completedAt: new Date() },
    })
    return errorResponse((err as Error).message, 503)
  }

  // 3. Source files için presigned GET URL'leri (worker indirebilsin)
  const sourceFileUrls = await Promise.all(
    data.sourceFiles.map(async (sf) => ({
      url: await getDownloadUrl(sf.s3Key),
      filename: sf.filename,
    })),
  )

  // 4. Worker'a forward et
  try {
    const workerResp = await startGeneration({
      orgId,
      generationId: gen.id,
      artifactType: cliType,
      prompt: data.prompt ?? undefined,
      language: data.language,
      sourceFileUrls,
      sourceUrls: data.sourceUrls,
      options: finalOptions,
      uploadUrl,
      outputExt: ext,
      outputMime: mime,
    })

    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'processing',
        workerJobId: workerResp.workerJobId,
        s3Key: outputKey,
        mimeType: mime,
      },
    })

    // Audit
    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'ai_generation_start',
      entityType: 'ai_generation',
      entityId: gen.id,
      newData: { artifactType: data.artifactType, sourceCount: data.sourceFiles.length + data.sourceUrls.length },
      request,
    })

    // (Shared mode — per-org account update kaldırıldı)

    return jsonResponse(
      { id: gen.id, status: 'processing', workerJobId: workerResp.workerJobId },
      202,
    )
  } catch (err) {
    logger.error('AI Studio', 'Worker startGeneration failed', { err: String(err), generationId: gen.id })
    await prisma.aiGeneration.update({
      where: { id: gen.id },
      data: {
        status: 'failed',
        errorMessage: 'Worker servisine ulaşılamıyor',
        completedAt: new Date(),
      },
    })
    return errorResponse('Worker servisi yanıt vermiyor. Lütfen daha sonra tekrar deneyin.', 502)
  }
}
