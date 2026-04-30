import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { syncStaffFromHis, syncDepartmentsFromHis } from '@/lib/his-integration'
import { hisSyncSchema } from '@/lib/validations'

/** POST /api/admin/integrations/his/sync — Manuel senkronizasyon başlat */
export const POST = withAdminRoute(async ({ request, organizationId }) => {
  const body = await parseBody(request)
  const parsed = hisSyncSchema.safeParse(body ?? {})
  if (!parsed.success) return errorResponse('Geçersiz sync tipi')

  const integration = await prisma.hisIntegration.findFirst({
    where: { organizationId, isActive: true },
  })

  if (!integration) {
    return errorResponse('Aktif HIS entegrasyonu bulunamadı', 404)
  }

  const { syncType } = parsed.data
  let result

  switch (syncType) {
    case 'STAFF_IMPORT':
      result = await syncStaffFromHis(integration)
      break
    case 'DEPARTMENT_IMPORT':
      result = await syncDepartmentsFromHis(integration)
      break
    case 'FULL_SYNC': {
      const deptResult = await syncDepartmentsFromHis(integration)
      const staffResult = await syncStaffFromHis(integration)
      result = {
        success: deptResult.success && staffResult.success,
        totalRecords: deptResult.totalRecords + staffResult.totalRecords,
        processedRecords: deptResult.processedRecords + staffResult.processedRecords,
        created: deptResult.created + staffResult.created,
        updated: deptResult.updated + staffResult.updated,
        deactivated: staffResult.deactivated,
        errors: [...deptResult.errors, ...staffResult.errors],
      }
      break
    }
  }

  return jsonResponse({ syncType, result })
}, { strict: true, requireOrganization: true })
