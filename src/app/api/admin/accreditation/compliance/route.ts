import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCurrentCompliance } from '@/lib/accreditation'
import type { StandardBody } from '@/lib/accreditation'

const VALID_BODIES: StandardBody[] = ['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA']

/** GET /api/admin/accreditation/compliance?standardBody=JCI */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const standardBodyParam = searchParams.get('standardBody')

  if (!standardBodyParam || !VALID_BODIES.includes(standardBodyParam as StandardBody)) {
    return errorResponse('Geçerli bir standart kuruluşu belirtin: JCI, ISO_9001, ISO_15189, TJC, OSHA')
  }

  const orgId = dbUser!.organizationId!

  try {
    const compliance = await getCurrentCompliance({
      organizationId: orgId,
      standardBody: standardBodyParam as StandardBody,
      requestedBy: dbUser!.id,
    })

    return jsonResponse({ compliance }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Uyumluluk hesaplanamadı'
    return errorResponse(message, 500)
  }
}
