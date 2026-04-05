import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { aiConnectSchema } from '@/lib/validations'
import { login, AiServiceError } from '@/app/admin/ai-content-studio/lib/ai-service-client'

/**
 * POST /api/admin/ai-content-studio/auth/connect
 *
 * Google AI bağlantısı başlatır. Rate limit ve audit log uygulanır.
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`ai-connect:${orgId}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla bağlantı denemesi. Lütfen bir saat sonra tekrar deneyin.', 429)

  const body = await parseBody<{ email: string; browser?: string }>(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = aiConnectSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || 'Geçersiz veri', 400)

  try {
    await login(parsed.data.browser, orgId)

    await prisma.aiGoogleConnection.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        userId: dbUser!.id,
        email: parsed.data.email,
        status: 'connected',
        lastVerifiedAt: new Date(),
      },
      update: {
        userId: dbUser!.id,
        email: parsed.data.email,
        status: 'connected',
        lastVerifiedAt: new Date(),
        errorMessage: null,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'ai_google_connect',
      entityType: 'AiGoogleConnection',
      newData: { email: parsed.data.email },
      request,
    })

    return jsonResponse({ success: true, email: parsed.data.email }, 201)
  } catch (err) {
    const errorMessage = err instanceof AiServiceError ? err.message : 'Bağlantı hatası'

    await prisma.aiGoogleConnection.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        userId: dbUser!.id,
        email: parsed.data.email,
        status: 'error',
        errorMessage,
      },
      update: {
        status: 'error',
        errorMessage,
      },
    })

    logger.error('AI Connect', 'Google bağlantısı başarısız', err)
    return errorResponse('Google bağlantısı kurulamadı. Lütfen tekrar deneyin.', 502)
  }
}
