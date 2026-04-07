import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Number(searchParams.get('limit') ?? '50')
  const entityType = searchParams.get('entityType')

  const where: Record<string, unknown> = { organizationId: dbUser!.organizationId! }
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
}
