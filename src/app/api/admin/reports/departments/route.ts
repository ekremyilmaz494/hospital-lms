import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'
import { resolveReportFilters, REPORTS_CACHE_HEADERS } from '../_shared'
// Cache-Control: private, max-age=30, stale-while-revalidate=60 (REPORTS_CACHE_HEADERS)

/**
 * Departman analiz raporu — departmentData.
 * "Departman" tab'ı için kullanılır.
 *
 * Aggregate'ler SQL groupBy ile çekilir: trainingAssignment.groupBy({ by: ['userId','status'] }) +
 * examAttempt.groupBy. JS-side flatMap zincirinden kaçınıldı.
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const orgId = organizationId

  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const { userDeptFilter, assignmentDateFilter, attemptDateFilter, trainingScope, departmentId } = resolved.filters

  try {
    const [departments, deptStaff, assignmentGroups, attemptAggregates] = await Promise.all([
      prisma.department.findMany({
        where: { organizationId: orgId, ...(departmentId ? { id: departmentId } : {}) },
        select: { id: true, name: true, color: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      // Departman başına aktif personel sayısı
      prisma.user.groupBy({
        by: ['departmentId'],
        where: {
          organizationId: orgId,
          role: 'staff' satisfies UserRole,
          isActive: true,
          departmentId: { not: null },
          ...userDeptFilter,
        },
        _count: { _all: true },
      }),
      // Atama durumları — user.departmentId üzerinden grupla
      // Prisma groupBy ilişkili alana göre gruplama yapamaz, bu yüzden
      // userId+status ile gruplayıp sonra dept'e map edeceğiz.
      prisma.trainingAssignment.groupBy({
        by: ['userId', 'status'],
        where: {
          training: trainingScope,
          user: {
            organizationId: orgId,
            role: 'staff' satisfies UserRole,
            isActive: true,
            departmentId: { not: null },
            ...userDeptFilter,
          },
          ...assignmentDateFilter,
        },
        _count: { _all: true },
      }),
      // Sınav puanları — userId başına aggregate
      prisma.examAttempt.groupBy({
        by: ['userId'],
        where: {
          training: trainingScope,
          postExamScore: { not: null },
          user: {
            organizationId: orgId,
            role: 'staff' satisfies UserRole,
            isActive: true,
            departmentId: { not: null },
            ...userDeptFilter,
          },
          ...attemptDateFilter,
        },
        _avg: { postExamScore: true },
        _count: { postExamScore: true },
      }),
    ])

    // userId → departmentId map (assignment + attempt'i dept'e bağlamak için)
    const userIds = new Set<string>([
      ...assignmentGroups.map(a => a.userId),
      ...attemptAggregates.map(a => a.userId),
    ])
    const users = userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, departmentId: true },
        })
      : []
    const userToDept = new Map(users.map(u => [u.id, u.departmentId]))

    // Dept başına: passed, failed, total, score sum & count
    type DeptAgg = { passed: number; failed: number; total: number; scoreSum: number; scoreCount: number }
    const deptAgg = new Map<string, DeptAgg>()
    const ensure = (id: string): DeptAgg => {
      let v = deptAgg.get(id)
      if (!v) { v = { passed: 0, failed: 0, total: 0, scoreSum: 0, scoreCount: 0 }; deptAgg.set(id, v) }
      return v
    }

    for (const g of assignmentGroups) {
      const deptId = userToDept.get(g.userId)
      if (!deptId) continue
      const agg = ensure(deptId)
      agg.total += g._count._all
      if (g.status === 'passed') agg.passed += g._count._all
      else if (g.status === 'failed') agg.failed += g._count._all
    }

    for (const a of attemptAggregates) {
      const deptId = userToDept.get(a.userId)
      if (!deptId) continue
      const avg = a._avg.postExamScore ? Number(a._avg.postExamScore) : 0
      const count = a._count.postExamScore
      const agg = ensure(deptId)
      // Toplam skor üzerinden ağırlıklı ortalama için sum*count
      agg.scoreSum += avg * count
      agg.scoreCount += count
    }

    const staffByDept = new Map(deptStaff.map(d => [d.departmentId!, d._count._all]))

    const departmentData = departments.map(d => {
      const agg = deptAgg.get(d.id) ?? { passed: 0, failed: 0, total: 0, scoreSum: 0, scoreCount: 0 }
      const personel = staffByDept.get(d.id) ?? 0
      const ortPuan = agg.scoreCount > 0 ? Math.round(agg.scoreSum / agg.scoreCount) : 0
      const tamamlanma = agg.total > 0 ? Math.round((agg.passed / agg.total) * 100) : 0
      return {
        dept: d.name,
        personel,
        tamamlanma,
        ortPuan,
        basarisiz: agg.failed,
        color: d.color || 'var(--color-primary)',
      }
    })

    return jsonResponse(
      { departmentData },
      200,
      REPORTS_CACHE_HEADERS,
    )
  } catch (err) {
    logger.error('Admin Reports/departments', 'Departman raporu alınamadı', err)
    return errorResponse('Departman raporu alınamadı', 503)
  }
}, { requireOrganization: true })
