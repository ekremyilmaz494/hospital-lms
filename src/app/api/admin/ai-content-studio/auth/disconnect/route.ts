import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { disconnectAuth } from '@/app/admin/ai-content-studio/lib/ai-service-client'

/**
 * POST /api/admin/ai-content-studio/auth/disconnect
 *
 * Google AI bağlantısını keser ve kaydı siler.
 */
export async function POST(request: Request) {
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
    await disconnectAuth()
  } catch (err) {
    logger.error('AI Disconnect', 'Sidecar cleanup hatası', err)
  }

  await prisma.aiGoogleConnection.delete({
    where: { organizationId: orgId },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'ai_google_disconnect',
    entityType: 'AiGoogleConnection',
    oldData: { email: connection.email },
    request,
  })

  return jsonResponse({ success: true })
}
