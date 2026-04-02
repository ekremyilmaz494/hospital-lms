import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_TTL = 300 // 5 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=180' }

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const cacheKey = `dashboard:charts:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [trendRaw, deptAssignments] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where: {
          training: { organizationId: orgId },
          assignedAt: { gte: sixMonthsAgo },
        },
        select: { status: true, assignedAt: true },
      }),
      prisma.trainingAssignment.findMany({
        where: { training: { organizationId: orgId } },
        select: {
          status: true,
          user: { select: { departmentRel: { select: { name: true } } } },
          examAttempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: { postExamScore: true, preExamScore: true },
          },
        },
        take: 500,
      }),
    ])

    // Trend data — son 6 ay
    const trendMap = new Map<string, { atanan: number; tamamlanan: number; basarisiz: number; month: string }>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      trendMap.set(key, { atanan: 0, tamamlanan: 0, basarisiz: 0, month: d.toLocaleDateString('tr-TR', { month: 'short' }) })
    }
    for (const a of trendRaw) {
      const d = new Date(a.assignedAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const entry = trendMap.get(key)
      if (!entry) continue
      entry.atanan++
      if (a.status === 'passed') entry.tamamlanan++
      if (a.status === 'failed') entry.basarisiz++
    }
    const trendData = Array.from(trendMap.values())

    // Department comparison
    const deptMap = new Map<string, { total: number; completed: number; scores: number[] }>()
    for (const a of deptAssignments) {
      const dept = a.user.departmentRel?.name ?? 'Diger'
      const existing = deptMap.get(dept) ?? { total: 0, completed: 0, scores: [] }
      existing.total++
      if (a.status === 'passed') {
        existing.completed++
        const score = Number(a.examAttempts[0]?.postExamScore ?? a.examAttempts[0]?.preExamScore ?? 0)
        existing.scores.push(score)
      }
      deptMap.set(dept, existing)
    }
    const departmentComparison = Array.from(deptMap.entries()).map(([dept, d]) => ({
      dept,
      oran: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
      puan: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
    }))

    const responseData = { trendData, departmentComparison }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Charts', 'Chart verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Chart verileri alinamadi', 503)
  }
}
