import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { testHisConnection } from '@/lib/his-integration'

/** POST /api/admin/integrations/his/test — HIS bağlantısını test et */
export const POST = withAdminRoute(async ({ organizationId }) => {
  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId },
  })

  if (!integration) {
    return errorResponse('Önce HIS entegrasyon ayarlarını kaydedin', 404)
  }

  const result = await testHisConnection(integration)
  return jsonResponse(result)
}, { strict: true, requireOrganization: true })
