import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  try {

  const now = new Date()

  // ── DB-side aggregation — memory'ye tum kayitlari cekmek yerine ──
  const [
    staffCount,
    activeStaffCount,
    trainingCount,
    activeTrainingCount,
    statusCounts,
    compulsoryTrainings,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
    prisma.training.count({ where: { organizationId: orgId } }),
    prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
    // Status bazli aggregation (DB'de hesaplanir)
    prisma.trainingAssignment.groupBy({
      by: ['status'],
      where: { training: { organizationId: orgId } },
      _count: true,
    }),
    prisma.training.findMany({
      where: { organizationId: orgId, isCompulsory: true, isActive: true },
      select: { id: true, title: true, complianceDeadline: true, regulatoryBody: true, assignments: { select: { status: true } } },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Status count'lari map'le
  const statusMap = new Map(statusCounts.map(s => [s.status, s._count]))
  const completedCount = statusMap.get('passed') ?? 0
  const failedCount = statusMap.get('failed') ?? 0
  const inProgressCount = statusMap.get('in_progress') ?? 0
  const totalAssignments = statusCounts.reduce((sum, s) => sum + s._count, 0)
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

  // Compliance stats (zorunlu egitimler)
  const compulsoryAssignments = compulsoryTrainings.flatMap(t => t.assignments)
  const compulsoryCompleted = compulsoryAssignments.filter(a => a.status === 'passed').length
  const complianceRate = compulsoryAssignments.length > 0
    ? Math.round((compulsoryCompleted / compulsoryAssignments.length) * 100)
    : 100

  // Compliance deadline alarmlari
  const complianceAlerts = compulsoryTrainings
    .filter(t => t.complianceDeadline && new Date(t.complianceDeadline) > now)
    .map(t => {
      const daysLeft = Math.ceil((new Date(t.complianceDeadline!).getTime() - now.getTime()) / 86400000)
      const totalAssigned = t.assignments.length
      const passed = t.assignments.filter((a: { status: string }) => a.status === 'passed').length
      return {
        training: t.title,
        regulatoryBody: t.regulatoryBody ?? '',
        daysLeft,
        complianceRate: totalAssigned > 0 ? Math.round((passed / totalAssigned) * 100) : 0,
        status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)

  // Overdue trainings — sadece ilk 5 (pagination ile DB'den)
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

  // Top performers — DB aggregation ile (sadece passed, en yuksek skor)
  const topPerformerData = await prisma.trainingAssignment.findMany({
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
    take: 200, // Son 200 tamamlanmis atama uzerinden hesapla
  })

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

  // Department comparison — DB aggregation
  const deptAssignments = await prisma.trainingAssignment.findMany({
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
    take: 5000, // Makul limit
  })

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

  // Trend data — son 6 ay icin aylik aggregation
  const trendData = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const monthCounts = await prisma.trainingAssignment.groupBy({
      by: ['status'],
      where: {
        training: { organizationId: orgId },
        assignedAt: { gte: start, lt: end },
      },
      _count: true,
    })

    const monthStatusMap = new Map(monthCounts.map(c => [c.status, c._count]))
    trendData.push({
      month: start.toLocaleDateString('tr-TR', { month: 'short' }),
      atanan: monthCounts.reduce((sum, c) => sum + c._count, 0),
      tamamlanan: monthStatusMap.get('passed') ?? 0,
      basarisiz: monthStatusMap.get('failed') ?? 0,
    })
  }

  // Recent activity
  const recentActivity = recentLogs.map(log => ({
    action: log.action,
    user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem',
    time: log.createdAt.toISOString(),
    type: log.action.includes('delete') ? 'error' : log.action.includes('create') ? 'success' : 'info',
  }))

  // Expiring certificates — ayri sorgu (limit 10)
  const sixtyDays = new Date(now.getTime() + 60 * 86400000)
  const expiringCertsData = await prisma.certificate.findMany({
    where: {
      training: { organizationId: orgId },
      expiresAt: { gte: now, lte: sixtyDays },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      training: { select: { title: true } },
    },
    orderBy: { expiresAt: 'asc' },
    take: 10,
  })
  const expiringCerts = expiringCertsData.map(c => {
    const daysLeft = Math.ceil((new Date(c.expiresAt!).getTime() - now.getTime()) / 86400000)
    return {
      name: `${c.user.firstName} ${c.user.lastName}`,
      cert: c.training.title,
      expiryDate: new Date(c.expiresAt!).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      daysLeft,
      status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
    }
  })

  return jsonResponse({
    stats: [
      { title: 'Toplam Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-primary)', trend: { value: activeStaffCount, label: 'aktif', isPositive: true } },
      { title: 'Aktif Egitim', value: activeTrainingCount, icon: 'GraduationCap', accentColor: 'var(--color-info)', trend: { value: trainingCount, label: 'toplam', isPositive: true } },
      { title: 'Tamamlanma Orani', value: `%${completionRate}`, icon: 'TrendingUp', accentColor: 'var(--color-success)', trend: { value: completedCount, label: 'tamamlanan', isPositive: true } },
      { title: 'Geciken Egitim', value: overdueTrainings.length, icon: 'AlertTriangle', accentColor: 'var(--color-error)', trend: { value: failedCount, label: 'basarisiz', isPositive: false } },
      { title: 'Uyum Orani', value: `%${complianceRate}`, icon: 'ShieldCheck', accentColor: complianceRate >= 80 ? 'var(--color-success)' : complianceRate >= 60 ? 'var(--color-warning)' : 'var(--color-error)', trend: { value: compulsoryTrainings.length, label: 'zorunlu egitim', isPositive: complianceRate >= 80 } },
    ],
    complianceAlerts,
    trendData,
    statusDistribution: [
      { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
      { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
      { name: 'Basarisiz', value: failedCount, color: 'var(--color-error)' },
      { name: 'Bekleyen', value: totalAssignments - completedCount - inProgressCount - failedCount, color: 'var(--color-warning)' },
    ],
    departmentComparison,
    overdueTrainings,
    expiringCerts,
    topPerformers,
    recentActivity,
  })

  } catch (err) {
    logger.error('Admin Dashboard', 'Dashboard verileri alinamadi', err instanceof Error ? err.message : err)
    return errorResponse('Dashboard verileri alinamadi, lutfen sayfayi yenileyin', 503)
  }
}
