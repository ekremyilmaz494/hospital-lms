import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'PENDING'
  const { page, limit } = safePagination(searchParams)

  const where = {
    organizationId: dbUser!.organizationId!,
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
}
