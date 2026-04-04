import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

/**
 * GET /api/admin/ai-content-studio/auth/status
 *
 * Organizasyonun Google AI bağlantı durumunu döndürür.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const connection = await prisma.aiGoogleConnection.findUnique({
    where: { organizationId: orgId },
  })

  if (!connection) {
    return jsonResponse({ connected: false })
  }

  return jsonResponse({
    connected: connection.status === 'connected',
    email: connection.email,
    status: connection.status,
    lastVerifiedAt: connection.lastVerifiedAt,
    lastUsedAt: connection.lastUsedAt,
    expiresAt: connection.expiresAt,
    errorMessage: connection.errorMessage,
  })
}
