import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { testHisConnection } from '@/lib/his-integration'

/** POST /api/admin/integrations/his/test — HIS bağlantısını test et */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId: dbUser!.organizationId! },
  })

  if (!integration) {
    return errorResponse('Önce HIS entegrasyon ayarlarını kaydedin', 404)
  }

  const result = await testHisConnection(integration)
  return jsonResponse(result)
}
