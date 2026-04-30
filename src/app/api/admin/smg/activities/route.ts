import { prisma } from '@/lib/prisma'
import { jsonResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'PENDING'
  const { page, limit } = safePagination(searchParams)

  const where = {
    organizationId,
    approvalStatus: status,
  }

  const [activities, total] = await Promise.all([
    prisma.smgActivity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.smgActivity.count({ where }),
  ])

  return jsonResponse({ activities, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })
