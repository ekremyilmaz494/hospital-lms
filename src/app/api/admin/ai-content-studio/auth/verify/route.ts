import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { verifyAuth, AiServiceError } from '@/app/admin/ai-content-studio/lib/ai-service-client'

/**
 * POST /api/admin/ai-content-studio/auth/verify
 *
 * Mevcut Google AI bağlantısının geçerliliğini doğrular.
 */
export async function POST() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const connection = await prisma.aiGoogleConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    return errorResponse('Aktif bağlantı bulunamadı', 404)
  }

  try {
    const result = await verifyAuth(orgId)

    if (result.valid) {
      await prisma.aiGoogleConnection.update({
        where: { organizationId: orgId },
        data: { status: 'connected', lastVerifiedAt: new Date(), errorMessage: null },
      })
      return jsonResponse({ valid: true, status: 'connected' })
    }

    await prisma.aiGoogleConnection.update({
      where: { organizationId: orgId },
      data: { status: 'expired', errorMessage: result.error || 'Doğrulama başarısız' },
    })
    return jsonResponse({ valid: false, status: 'expired', error: result.error })
  } catch (err) {
    const errorMessage = err instanceof AiServiceError ? err.message : 'Doğrulama hatası'

    await prisma.aiGoogleConnection.update({
      where: { organizationId: orgId },
      data: { status: 'error', errorMessage },
    })

    logger.error('AI Verify', 'Bağlantı doğrulaması başarısız', err)
    return errorResponse('Doğrulama sırasında hata oluştu', 502)
  }
}
