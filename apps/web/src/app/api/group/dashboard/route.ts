import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withGroupRoute } from '@/lib/api-handler'
import { getCached, setCached } from '@/lib/redis'
import { fetchOrgKpis } from '@/lib/dashboard/aggregations'
import { logger } from '@/lib/logger'

const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' }

/**
 * GET /api/group/dashboard
 *
 * Grup yöneticisi (esas yönetici) için tüm grup hastanelerinin KONSOLİDE roll-up'ı.
 * Her hastanenin KPI'ları `fetchOrgKpis` ile (admin paneliyle AYNI kaynak) hesaplanır →
 * hastaneler arası toplanır + hastane-başı kırılım döner. Uyum oranı zorunlu-eğitim atama
 * sayısına göre AĞIRLIKLI hesaplanır (basit ortalama değil). Grup seviyesinde 60s cache.
 */
export const GET = withGroupRoute(async ({ groupId }) => {
  const cacheKey = `group:dashboard:${groupId}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, CACHE_HEADERS)

  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      organizations: {
        select: { id: true, name: true, code: true, isActive: true, isSuspended: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  if (!group) return errorResponse('Grup bulunamadı', 404)

  const orgs = group.organizations
  const settled = await Promise.all(
    orgs.map(async (o) => {
      try {
        return { org: o, kpis: await fetchOrgKpis(o.id) }
      } catch (err) {
        logger.error('group-dashboard', 'Hastane KPI hesaplanamadı', {
          orgId: o.id,
          error: err instanceof Error ? err.message : err,
        })
        return null
      }
    }),
  )
  const rows = settled.filter((r): r is NonNullable<typeof r> => r !== null)

  const totalStaff = rows.reduce((s, r) => s + r.kpis.staffCount, 0)
  const totalActiveStaff = rows.reduce((s, r) => s + r.kpis.activeStaffCount, 0)
  const totalActiveTrainings = rows.reduce((s, r) => s + r.kpis.activeTrainingCount, 0)
  const totalAssignments = rows.reduce((s, r) => s + r.kpis.totalAssignments, 0)
  const totalCompleted = rows.reduce((s, r) => s + r.kpis.completedCount, 0)
  const totalOverdue = rows.reduce((s, r) => s + r.kpis.overdueCount, 0)
  const completionRate = totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0

  // Ağırlıklı uyum: tüm hastanelerin zorunlu-eğitim atama toplamı üzerinden.
  const totalCompulsory = rows.reduce((s, r) => s + r.kpis.compulsoryAssignmentCount, 0)
  const totalCompulsoryDone = rows.reduce((s, r) => s + r.kpis.compulsoryCompletedCount, 0)
  const complianceRate = totalCompulsory > 0 ? Math.round((totalCompulsoryDone / totalCompulsory) * 100) : null

  const hospitals = rows.map((r) => ({
    id: r.org.id,
    name: r.org.name,
    code: r.org.code,
    isActive: r.org.isActive,
    isSuspended: r.org.isSuspended,
    staffCount: r.kpis.staffCount,
    activeTrainingCount: r.kpis.activeTrainingCount,
    completionRate: r.kpis.completionRate,
    overdueCount: r.kpis.overdueCount,
    complianceRate: r.kpis.hasCompliance ? r.kpis.complianceRate : null,
  }))

  const data = {
    groupName: group.name,
    hospitalCount: orgs.length,
    totals: {
      totalStaff,
      totalActiveStaff,
      totalActiveTrainings,
      completionRate,
      totalOverdue,
      complianceRate,
    },
    hospitals,
  }

  await setCached(cacheKey, data, 60)
  return jsonResponse(data, 200, CACHE_HEADERS)
})
