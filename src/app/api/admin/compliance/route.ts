import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'

/**
 * GET /api/admin/compliance
 * Zorunlu eğitim uyum (compliance) raporu.
 * Sağlık Bakanlığı + akreditasyon denetimleri için tasarlanmıştır.
 *
 * Hesaplama mantığı:
 *   - Her eğitim için status sayımı groupBy ile alınır (take/limit yok → büyük hastanede bile doğru).
 *   - "Atanma uyumu": passed / totalAssigned (klasik görünüm).
 *   - "Gerçek uyum": totalPassed / (allStaff × totalCompulsoryTrainings) — atanmamış personeli de
 *     uyumsuz sayar. Akreditasyon denetiminde bu metrik esas alınır.
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const orgId = organizationId

  const allowed = await checkRateLimit(`compliance:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  try {
    const now = new Date()

    // 1) Zorunlu eğitim metadata'sı (assignments YOK — sayım ayrı aggregate ile)
    const trainings = await prisma.training.findMany({
      where: {
        organizationId: orgId,
        isCompulsory: true,
        isActive: true,
        publishStatus: { not: 'archived' },
      },
      select: {
        id: true,
        title: true,
        category: true,
        regulatoryBody: true,
        complianceDeadline: true,
        renewalPeriodMonths: true,
      },
      orderBy: { complianceDeadline: 'asc' },
      take: 100,
    })

    const trainingIds = trainings.map(t => t.id)

    // Hiç zorunlu eğitim tanımlı değilse erken dön
    if (trainingIds.length === 0) {
      const allStaffCount = await prisma.user.count({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
      })
      return jsonResponse({
        summary: {
          totalCompulsoryTrainings: 0,
          fullyCompliantTrainings: 0,
          overallComplianceRate: 0,
          trueComplianceRate: 0,
          totalStaff: allStaffCount,
          urgentDeadlineCount: 0,
          warningDeadlineCount: 0,
          totalUnassigned: 0,
        },
        trainingCompliance: [],
        urgentDeadlines: [],
        departmentCompliance: [],
      }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
    }

    // 2) Paralel: staff listesi (dept ile), status sayımı, non-compliant detayı
    const [staffList, statusAgg, nonCompliantRaw] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
        select: { id: true, departmentRel: { select: { name: true } } },
      }),
      prisma.trainingAssignment.groupBy({
        by: ['trainingId', 'status'],
        where: { trainingId: { in: trainingIds } },
        _count: { _all: true },
      }),
      // Her eğitim için tamamlamayan personel listesi (detay paneli için)
      // Cap: 500 kayıt (20 eğitim × 25 ≈ yeterli örnek)
      prisma.trainingAssignment.findMany({
        where: {
          trainingId: { in: trainingIds },
          status: { not: 'passed' },
        },
        select: {
          trainingId: true,
          status: true,
          userId: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              departmentRel: { select: { name: true } },
            },
          },
          examAttempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: { postExamScore: true },
          },
        },
        take: 500,
      }),
    ])

    const allStaff = staffList.length

    // Status sayımlarını (trainingId → status → count) map'e çevir
    const countByTraining = new Map<string, Record<string, number>>()
    const assignedUsersByTraining = new Map<string, Set<string>>()
    for (const row of statusAgg) {
      const existing = countByTraining.get(row.trainingId) ?? {}
      existing[row.status] = row._count._all
      countByTraining.set(row.trainingId, existing)
    }

    // Hangi user hangi eğitime atanmış — unassigned hesabı için
    // Staff listesi dışından (admin/super_admin) atananları filtrele — sadece staff popülasyonu esas
    const staffIdSet = new Set(staffList.map(s => s.id))
    const assignmentPairs = await prisma.trainingAssignment.findMany({
      where: { trainingId: { in: trainingIds }, userId: { in: staffList.map(s => s.id) } },
      select: { trainingId: true, userId: true },
    })
    for (const p of assignmentPairs) {
      const set = assignedUsersByTraining.get(p.trainingId) ?? new Set()
      set.add(p.userId)
      assignedUsersByTraining.set(p.trainingId, set)
    }

    // Non-compliant personeli training'e göre grupla (max 10 kayıt/eğitim)
    const nonCompliantByTraining = new Map<string, Array<{
      id: string; name: string; email: string; department: string;
      status: string; lastScore: number | null;
    }>>()
    for (const a of nonCompliantRaw) {
      const list = nonCompliantByTraining.get(a.trainingId) ?? []
      if (list.length < 10) {
        list.push({
          id: a.user.id,
          name: `${a.user.firstName} ${a.user.lastName}`,
          email: a.user.email,
          department: a.user.departmentRel?.name ?? '',
          status: a.status,
          lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : null,
        })
        nonCompliantByTraining.set(a.trainingId, list)
      }
    }

    // 3) Eğitim bazlı uyum özeti
    const trainingCompliance = trainings.map(t => {
      const counts = countByTraining.get(t.id) ?? {}
      const passed = counts['passed'] ?? 0
      const failed = counts['failed'] ?? 0
      const notStarted = counts['assigned'] ?? 0
      const inProgress = counts['in_progress'] ?? 0
      const totalAssigned = passed + failed + notStarted + inProgress

      const assignedStaffCount = assignedUsersByTraining.get(t.id)?.size ?? 0
      const unassigned = Math.max(0, allStaff - assignedStaffCount)

      // Klasik oran: sadece atananlar üzerinden
      const complianceRate = totalAssigned > 0
        ? Math.round((passed / totalAssigned) * 100)
        : 0
      // Denetim oranı: atanmamış personel de dahil
      const trueComplianceRate = allStaff > 0
        ? Math.round((passed / allStaff) * 100)
        : 0

      let deadlineStatus: 'ok' | 'warning' | 'critical' | 'overdue' = 'ok'
      let daysLeft: number | null = null
      if (t.complianceDeadline) {
        daysLeft = Math.ceil(
          (new Date(t.complianceDeadline).getTime() - now.getTime()) / 86400000
        )
        if (daysLeft < 0) deadlineStatus = 'overdue'
        else if (daysLeft <= 7) deadlineStatus = 'critical'
        else if (daysLeft <= 30) deadlineStatus = 'warning'
      }

      return {
        id: t.id,
        title: t.title,
        category: t.category,
        regulatoryBody: t.regulatoryBody,
        complianceDeadline: t.complianceDeadline?.toISOString() ?? null,
        renewalPeriodMonths: t.renewalPeriodMonths,
        deadlineStatus,
        daysLeft,
        stats: {
          totalAssigned,
          passed,
          failed,
          notStarted,
          inProgress,
          unassigned,
          complianceRate,
          trueComplianceRate,
        },
        nonCompliantStaff: nonCompliantByTraining.get(t.id) ?? [],
      }
    })

    // 4) Genel özet
    const totalCompulsory = trainings.length
    const fullyCompliant = trainingCompliance.filter(
      t => t.stats.trueComplianceRate === 100
    ).length

    const totalPassed = trainingCompliance.reduce((s, t) => s + t.stats.passed, 0)
    const totalAssignedOverall = trainingCompliance.reduce((s, t) => s + t.stats.totalAssigned, 0)
    const totalUnassigned = trainingCompliance.reduce((s, t) => s + t.stats.unassigned, 0)

    // Atama bazlı ortalama (atanmış grup için)
    const overallComplianceRate = totalAssignedOverall > 0
      ? Math.round((totalPassed / totalAssignedOverall) * 100)
      : 0
    // Denetim bazlı ortalama (atanmamış personel de dahil)
    const expected = allStaff * totalCompulsory
    const trueComplianceRate = expected > 0
      ? Math.round((totalPassed / expected) * 100)
      : 0

    const urgentDeadlines = trainingCompliance
      .filter(t => ['overdue', 'critical', 'warning'].includes(t.deadlineStatus))
      .map(t => ({
        id: t.id,
        title: t.title,
        deadline: t.complianceDeadline,
        daysLeft: t.daysLeft,
        status: t.deadlineStatus,
        complianceRate: t.stats.complianceRate,
        trueComplianceRate: t.stats.trueComplianceRate,
        nonCompliantCount: t.stats.totalAssigned - t.stats.passed + t.stats.unassigned,
      }))

    const urgentDeadlineCount = trainingCompliance.filter(
      t => t.deadlineStatus === 'overdue' || t.deadlineStatus === 'critical'
    ).length
    const warningDeadlineCount = trainingCompliance.filter(
      t => t.deadlineStatus === 'warning'
    ).length

    // 5) Departman bazlı uyum — nonCompliantRaw + staffList üzerinden in-memory aggregate
    //    Tüm atamaları çekmek yerine status aggregate + staff dept map.
    //    Dept uyumu: her atamanın status'u dept bazında sayılır (TÜM eğitimler dahil).
    const userDeptMap = new Map<string, string>()
    for (const s of staffList) {
      userDeptMap.set(s.id, s.departmentRel?.name ?? 'Diğer')
    }

    // Tüm atama status'larını dept için tek sorguda grupla
    const deptAgg = await prisma.trainingAssignment.groupBy({
      by: ['userId', 'status'],
      where: { trainingId: { in: trainingIds }, userId: { in: [...staffIdSet] } },
      _count: { _all: true },
    })

    const deptMap = new Map<string, { total: number; passed: number }>()
    for (const row of deptAgg) {
      const dept = userDeptMap.get(row.userId) ?? 'Diğer'
      const entry = deptMap.get(dept) ?? { total: 0, passed: 0 }
      entry.total += row._count._all
      if (row.status === 'passed') entry.passed += row._count._all
      deptMap.set(dept, entry)
    }
    const departmentCompliance = Array.from(deptMap.entries())
      .map(([dept, d]) => ({
        dept,
        total: d.total,
        passed: d.passed,
        rate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0,
        riskLevel: d.total === 0
          ? 'low'
          : (d.passed / d.total) < 0.6 ? 'high'
          : (d.passed / d.total) < 0.8 ? 'medium'
          : 'low',
      }))
      .sort((a, b) => a.rate - b.rate)

    return jsonResponse({
      summary: {
        totalCompulsoryTrainings: totalCompulsory,
        fullyCompliantTrainings: fullyCompliant,
        overallComplianceRate,
        trueComplianceRate,
        totalStaff: allStaff,
        urgentDeadlineCount,
        warningDeadlineCount,
        totalUnassigned,
      },
      trainingCompliance,
      urgentDeadlines,
      departmentCompliance,
    }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Admin Compliance', 'Uyum raporu alınamadı', err)
    return errorResponse('Uyum raporu alınamadı', 503)
  }
}, { requireOrganization: true })
