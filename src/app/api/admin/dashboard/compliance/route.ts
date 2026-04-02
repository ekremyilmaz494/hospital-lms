import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_TTL = 180 // 3 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const cacheKey = `dashboard:compliance:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    const now = new Date()

    const overdueAssignments = await prisma.trainingAssignment.findMany({
      where: {
        status: { not: 'passed' },
        training: { organizationId: orgId, endDate: { lt: now } },
      },
      include: {
        user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
        training: { select: { title: true, endDate: true } },
      },
      orderBy: { training: { endDate: 'desc' } },
      take: 5,
    })

    const overdueTrainings = overdueAssignments.map(a => ({
      assignmentId: a.id,
      trainingId: a.trainingId,
      name: `${a.user.firstName} ${a.user.lastName}`,
      dept: a.user.departmentRel?.name ?? '',
      training: a.training.title,
      dueDate: new Date(a.training.endDate).toISOString().split('T')[0],
      daysOverdue: Math.floor((now.getTime() - new Date(a.training.endDate).getTime()) / 86400000),
      color: 'var(--color-error)',
    }))

    const responseData = { overdueTrainings }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Compliance', 'Compliance verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Compliance verileri alinamadi', 503)
  }
}
