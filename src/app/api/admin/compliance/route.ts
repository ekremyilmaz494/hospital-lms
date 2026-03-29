import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/compliance
 * Zorunlu eğitimler için uyum (compliance) raporu
 * Sağlık Bakanlığı ve akreditasyon denetimleri için tasarlanmıştır.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`compliance:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  try {
    const now = new Date()

    const [compulsoryTrainings, allStaff] = await Promise.all([
      prisma.training.findMany({
        where: { organizationId: orgId, isCompulsory: true },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, departmentId: true, departmentRel: { select: { name: true } } } },
              examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, postExamCompletedAt: true } },
            },
          },
          certificates: { select: { userId: true, issuedAt: true, expiresAt: true } },
        },
        orderBy: { complianceDeadline: 'asc' },
      }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
    ])

    // Eğitim bazlı uyum özeti
    const trainingCompliance = compulsoryTrainings.map(t => {
      const totalAssigned = t.assignments.length
      const passed = t.assignments.filter(a => a.status === 'passed').length
      const failed = t.assignments.filter(a => a.status === 'failed').length
      const notStarted = t.assignments.filter(a => a.status === 'assigned').length
      const inProgress = t.assignments.filter(a => a.status === 'in_progress').length

      // Henüz atanmamış personel sayısı
      const assignedUserIds = new Set(t.assignments.map(a => a.userId))
      const unassigned = Math.max(0, allStaff - assignedUserIds.size)

      const complianceRate = totalAssigned > 0 ? Math.round((passed / totalAssigned) * 100) : 0

      let deadlineStatus: 'ok' | 'warning' | 'critical' | 'overdue' = 'ok'
      if (t.complianceDeadline) {
        const daysLeft = Math.ceil((new Date(t.complianceDeadline).getTime() - now.getTime()) / 86400000)
        if (daysLeft < 0) deadlineStatus = 'overdue'
        else if (daysLeft <= 7) deadlineStatus = 'critical'
        else if (daysLeft <= 30) deadlineStatus = 'warning'
      }

      // Tamamlamayan personel listesi (ilk 10)
      const nonCompliantStaff = t.assignments
        .filter(a => a.status !== 'passed')
        .slice(0, 10)
        .map(a => ({
          id: a.user.id,
          name: `${a.user.firstName} ${a.user.lastName}`,
          department: a.user.departmentRel?.name ?? '',
          status: a.status,
          lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : null,
        }))

      return {
        id: t.id,
        title: t.title,
        category: t.category,
        regulatoryBody: t.regulatoryBody,
        complianceDeadline: t.complianceDeadline?.toISOString() ?? null,
        renewalPeriodMonths: t.renewalPeriodMonths,
        deadlineStatus,
        stats: { totalAssigned, passed, failed, notStarted, inProgress, unassigned, complianceRate },
        nonCompliantStaff,
      }
    })

    // Genel uyum özeti
    const totalCompulsory = compulsoryTrainings.length
    const fullyCompliant = trainingCompliance.filter(t => t.stats.complianceRate === 100).length
    const overallComplianceRate = totalCompulsory > 0
      ? Math.round(trainingCompliance.reduce((sum, t) => sum + t.stats.complianceRate, 0) / totalCompulsory)
      : 100

    // Yaklaşan deadline'lar (30 gün içinde)
    const urgentDeadlines = trainingCompliance
      .filter(t => t.deadlineStatus === 'critical' || t.deadlineStatus === 'warning' || t.deadlineStatus === 'overdue')
      .map(t => ({
        title: t.title,
        deadline: t.complianceDeadline,
        status: t.deadlineStatus,
        complianceRate: t.stats.complianceRate,
        nonCompliantCount: t.stats.totalAssigned - t.stats.passed,
      }))

    // Departman bazlı uyum oranı
    const deptComplianceMap = new Map<string, { total: number; passed: number }>()
    for (const t of compulsoryTrainings) {
      for (const a of t.assignments) {
        const dept = a.user.departmentRel?.name ?? 'Diğer'
        const existing = deptComplianceMap.get(dept) ?? { total: 0, passed: 0 }
        existing.total++
        if (a.status === 'passed') existing.passed++
        deptComplianceMap.set(dept, existing)
      }
    }
    const departmentCompliance = Array.from(deptComplianceMap.entries()).map(([dept, d]) => ({
      dept,
      total: d.total,
      passed: d.passed,
      rate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0,
      riskLevel: d.total > 0 && (d.passed / d.total) < 0.6 ? 'high' : d.total > 0 && (d.passed / d.total) < 0.8 ? 'medium' : 'low',
    })).sort((a, b) => a.rate - b.rate)

    return jsonResponse({
      summary: {
        totalCompulsoryTrainings: totalCompulsory,
        fullyCompliantTrainings: fullyCompliant,
        overallComplianceRate,
        totalStaff: allStaff,
        urgentDeadlineCount: urgentDeadlines.length,
      },
      trainingCompliance,
      urgentDeadlines,
      departmentCompliance,
    })
  } catch (err) {
    logger.error('Admin Compliance', 'Uyum raporu alınamadı', err)
    return errorResponse('Uyum raporu alınamadı', 503)
  }
}
