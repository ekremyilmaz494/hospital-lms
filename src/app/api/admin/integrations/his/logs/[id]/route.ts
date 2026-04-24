import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

/** GET /api/admin/integrations/his/logs/[id] — Sync log detayı (hata listesi dahil) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const log = await prisma.syncLog.findFirst({
    where: {
      id,
      organizationId: dbUser!.organizationId!, // cross-tenant koruma
    },
  })

  if (!log) return errorResponse('Log kaydı bulunamadı', 404)

  return jsonResponse({ log })
}
