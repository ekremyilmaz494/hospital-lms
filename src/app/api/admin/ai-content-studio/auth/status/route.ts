// AI İçerik Stüdyosu — Google NotebookLM bağlantı durumu
// GET /api/admin/ai-content-studio/auth/status

import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const connection = await prisma.aiGoogleConnection.findUnique({
    where: { organizationId: dbUser!.organizationId! },
  })

  if (!connection) {
    return jsonResponse({
      connected: false,
      email: null,
      status: 'not_connected',
      lastVerifiedAt: null,
      lastUsedAt: null,
      expiresAt: null,
    })
  }

  return jsonResponse({
    connected: connection.status === 'connected',
    email: connection.email,
    status: connection.status,
    method: connection.method,
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
    lastUsedAt: connection.lastUsedAt?.toISOString() ?? null,
    expiresAt: connection.expiresAt?.toISOString() ?? null,
    errorMessage: connection.errorMessage,
  })
}
