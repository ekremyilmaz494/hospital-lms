import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_TTL = 120 // 2 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const cacheKey = `dashboard:activity:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    const [topPerformerData, recentLogs] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where: {
          status: 'passed',
          training: { organizationId: orgId },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
          examAttempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: { postExamScore: true, preExamScore: true },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    // Top performers aggregation
    const performerMap = new Map<string, { name: string; department: string; scores: number[]; courses: number; initials: string }>()
    for (const a of topPerformerData) {
      const key = a.userId
      const existing = performerMap.get(key)
      const score = Number(a.examAttempts[0]?.postExamScore ?? a.examAttempts[0]?.preExamScore ?? 0)
      if (existing) {
        existing.scores.push(score)
        existing.courses++
      } else {
        const fn = a.user.firstName ?? ''
        const ln = a.user.lastName ?? ''
        performerMap.set(key, {
          name: `${fn} ${ln}`,
          department: a.user.departmentRel?.name ?? '',
          scores: [score],
          courses: 1,
          initials: `${fn[0] ?? ''}${ln[0] ?? ''}`.toUpperCase(),
        })
      }
    }
    const topPerformers = Array.from(performerMap.values())
      .map(p => ({ ...p, score: Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length), color: 'var(--color-primary)' }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)

    // Recent activity
    const recentActivity = recentLogs.map(log => ({
      action: log.action,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem',
      time: log.createdAt.toISOString(),
      type: log.action.includes('delete') ? 'error' : log.action.includes('create') ? 'success' : 'info',
    }))

    const responseData = { topPerformers, recentActivity }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Activity', 'Activity verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Activity verileri alinamadi', 503)
  }
}
