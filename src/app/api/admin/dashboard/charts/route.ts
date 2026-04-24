import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

const CACHE_TTL = 300 // 5 dakika
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' }

interface TrendRow {
  month_key: string
  month_label: string
  total: bigint
  completed: bigint
  failed: bigint
}

interface DeptRow {
  dept: string
  total: bigint
  completed: bigint
  avg_score: number | null
}

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const cacheKey = `dashboard:charts:${orgId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    // Archived/inactive training'leri trend ve departman raporlarından dışarı al — yanıltıcı sayım önlenir
    const [trendRows, deptRows] = await Promise.all([
      prisma.$queryRaw<TrendRow[]>`
        SELECT
          to_char(ta.assigned_at, 'YYYY-MM') AS month_key,
          to_char(ta.assigned_at, 'Mon', 'NLS_DATE_LANGUAGE=Turkish') AS month_label,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE ta.status = 'passed')::bigint AS completed,
          COUNT(*) FILTER (WHERE ta.status = 'failed')::bigint AS failed
        FROM training_assignments ta
        JOIN trainings t ON t.id = ta.training_id
        WHERE t.organization_id = ${orgId}::uuid
          AND t.is_active = true
          AND t.publish_status <> 'archived'
          AND ta.assigned_at >= ${sixMonthsAgo}
        GROUP BY month_key, month_label
        ORDER BY month_key
      `,
      // Departman karşılaştırma — tek sorguda aggregation
      prisma.$queryRaw<DeptRow[]>`
        SELECT
          COALESCE(d.name, 'Diğer') AS dept,
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE ta.status = 'passed')::bigint AS completed,
          AVG(ea.post_exam_score) FILTER (WHERE ta.status = 'passed') AS avg_score
        FROM training_assignments ta
        JOIN trainings t ON t.id = ta.training_id
        JOIN users u ON u.id = ta.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN LATERAL (
          SELECT post_exam_score
          FROM exam_attempts
          WHERE assignment_id = ta.id
          ORDER BY attempt_number DESC
          LIMIT 1
        ) ea ON true
        WHERE t.organization_id = ${orgId}::uuid
          AND t.is_active = true
          AND t.publish_status <> 'archived'
        GROUP BY d.name
      `,
    ])

    // Trend data — 6 aylık grid oluştur (veri olmayan aylar 0 olsun)
    const trendMap = new Map<string, { atanan: number; tamamlanan: number; basarisiz: number; month: string }>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      trendMap.set(key, {
        atanan: 0,
        tamamlanan: 0,
        basarisiz: 0,
        month: d.toLocaleDateString('tr-TR', { month: 'short' }),
      })
    }
    for (const row of trendRows) {
      const entry = trendMap.get(row.month_key)
      if (entry) {
        entry.atanan = Number(row.total)
        entry.tamamlanan = Number(row.completed)
        entry.basarisiz = Number(row.failed)
      }
    }
    const trendData = Array.from(trendMap.values())

    // Department comparison
    const departmentComparison = deptRows.map((row) => ({
      dept: row.dept,
      oran: Number(row.total) > 0 ? Math.round((Number(row.completed) / Number(row.total)) * 100) : 0,
      puan: row.avg_score !== null ? Math.round(Number(row.avg_score)) : 0,
    }))

    const responseData = { trendData, departmentComparison }

    await setCached(cacheKey, responseData, CACHE_TTL)
    return jsonResponse(responseData, 200, CACHE_HEADERS)
  } catch (err) {
    logger.error('Dashboard Charts', 'Chart verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Chart verileri alinamadi', 503)
  }
}
