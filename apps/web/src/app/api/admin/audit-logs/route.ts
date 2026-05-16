import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Number(searchParams.get('limit') ?? '50')
  const entityType = searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId }
  if (entityType) where.entityType = entityType

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return jsonResponse({ logs, total, page, limit, totalPages: Math.ceil(total / limit) }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
}, { requireOrganization: true })
