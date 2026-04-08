import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'

/** GET /api/admin/accreditation/reports?standardBody=JCI&page=1&limit=20 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const standardBody = searchParams.get('standardBody') ?? undefined
  const { page, limit, skip } = safePagination(searchParams)

  const orgId = dbUser!.organizationId!

  try {
    const where = {
      organizationId: orgId,
      ...(standardBody ? { standardBody } : {}),
    }

    const [reports, total] = await Promise.all([
      prisma.accreditationReport.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          standardBody: true,
          generatedAt: true,
          periodStart: true,
          periodEnd: true,
          overallComplianceRate: true,
          generatedBy: true,
        },
      }),
      prisma.accreditationReport.count({ where }),
    ])

    return jsonResponse({
      reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch {
    return errorResponse('Raporlar getirilemedi', 500)
  }
}
