/**
 * AI Stüdyo kaynak dosyası için presigned S3 PUT URL.
 *
 * Akış: Client filename + size + mimeType gönderir →
 *       sunucu temp generationId + S3 key üretir → presigned URL döner →
 *       client S3'e direkt yükler → generation create endpoint'inde
 *       sourceFiles[] içinde s3Key ile referans verir.
 */
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getUploadUrl, aiSourceKey } from '@/lib/s3'
import { aiSourcePresignSchema } from '@/lib/ai-content-studio/validations'
import { checkRateLimit } from '@/lib/redis'
import crypto from 'crypto'

export const POST = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  const allowed = await checkRateLimit(`ai-source-presign:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme isteği.', 429)

  const body = await parseBody(request)
  const parsed = aiSourcePresignSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz dosya bilgisi.', 400)
  }

  // Geçici "session" ID'si — generation create edildiğinde gerçek generationId
  // oluşturulur ve dosya o klasöre taşınmaz; aiSourceKey() zaten generationId
  // segment'i içinde random UUID ekliyor — birden çok kaynak çakışmaz.
  const sessionId = crypto.randomUUID()

  let key: string
  try {
    key = aiSourceKey(organizationId, sessionId, parsed.data.filename)
  } catch (err) {
    return errorResponse((err as Error).message, 400)
  }

  let uploadUrl: string
  try {
    uploadUrl = await getUploadUrl(key, parsed.data.mimeType)
  } catch (err) {
    return errorResponse((err as Error).message ?? 'Yükleme URL alınamadı.', 503)
  }

  return jsonResponse({
    uploadUrl,
    s3Key: key,
    sessionId,
    expiresInSeconds: 1800,
  })
}, { requireOrganization: true })
