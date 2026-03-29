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

  // Parallel queries for dashboard data
  const [
    staffCount,
    activeStaffCount,
    trainingCount,
    activeTrainingCount,
    assignments,
    recentLogs,
    compulsoryTrainings,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
    prisma.training.count({ where: { organizationId: orgId } }),
    prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.trainingAssignment.findMany({
      where: { training: { organizationId: orgId } },
      include: {
        user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
        training: { select: { title: true, category: true, endDate: true, isCompulsory: true, complianceDeadline: true, regulatoryBody: true } },
        examAttempts: { select: { postExamScore: true, preExamScore: true, isPassed: true, status: true }, orderBy: { attemptNumber: 'desc' }, take: 1 },
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.training.findMany({
      where: { organizationId: orgId, isCompulsory: true, isActive: true },
      select: { id: true, title: true, complianceDeadline: true, regulatoryBody: true, assignments: { select: { status: true } } },
    }),
  ])

  // Calculate stats from assignments
  const completedCount = assignments.filter(a => a.status === 'passed').length
  const failedCount = assignments.filter(a => a.status === 'failed').length
  const inProgressCount = assignments.filter(a => a.status === 'in_progress').length
  const totalAssignments = assignments.length
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

  // Compliance stats (zorunlu eğitimler için uyum oranı)
  const compulsoryAssignments = assignments.filter(a => a.training?.isCompulsory)
  const compulsoryCompleted = compulsoryAssignments.filter(a => a.status === 'passed').length
  const complianceRate = compulsoryAssignments.length > 0
    ? Math.round((compulsoryCompleted / compulsoryAssignments.length) * 100)
    : 100

  // Compliance deadline alarmları (zorunlu eğitim son tarihi yaklaşanlar)
  const complianceAlerts = compulsoryTrainings
    .filter(t => t.complianceDeadline && new Date(t.complianceDeadline) > now)
    .map(t => {
      const daysLeft = Math.ceil((new Date(t.complianceDeadline!).getTime() - now.getTime()) / 86400000)
      const totalAssigned = t.assignments.length
      const passed = t.assignments.filter(a => a.status === 'passed').length
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

  // Overdue trainings (training endDate passed but assignment not completed)
  const overdueTrainings = assignments
    .filter(a => a.status !== 'passed' && a.training && a.training.endDate && new Date(a.training.endDate) < now)
    .slice(0, 5)
    .map(a => ({
      assignmentId: a.id,
      trainingId: a.trainingId,
      name: `${a.user.firstName} ${a.user.lastName}`,
      dept: a.user.departmentRel?.name ?? '',
      training: a.training.title,
      dueDate: new Date(a.training.endDate).toISOString().split('T')[0],
      daysOverdue: Math.floor((now.getTime() - new Date(a.training.endDate).getTime()) / 86400000),
      color: 'var(--color-error)',
    }))

  // Top performers (highest scores)
  const performerMap = new Map<string, { name: string; department: string; scores: number[]; courses: number; initials: string }>()
  for (const a of assignments) {
    if (a.status !== 'passed') continue
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

  // Department comparison
  const deptMap = new Map<string, { total: number; completed: number; scores: number[] }>()
  for (const a of assignments) {
    const dept = a.user.departmentRel?.name ?? 'Diğer'
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

  // Recent activity
  const recentActivity = recentLogs.map(log => ({
    action: log.action,
    user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistem',
    time: log.createdAt.toISOString(),
    type: log.action.includes('delete') ? 'error' : log.action.includes('create') ? 'success' : 'info',
  }))

  return jsonResponse({
    stats: [
      { title: 'Toplam Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-primary)', trend: { value: activeStaffCount, label: 'aktif', isPositive: true } },
      { title: 'Aktif Eğitim', value: activeTrainingCount, icon: 'GraduationCap', accentColor: 'var(--color-info)', trend: { value: trainingCount, label: 'toplam', isPositive: true } },
      { title: 'Tamamlanma Oranı', value: `%${completionRate}`, icon: 'TrendingUp', accentColor: 'var(--color-success)', trend: { value: completedCount, label: 'tamamlanan', isPositive: true } },
      { title: 'Geciken Eğitim', value: overdueTrainings.length, icon: 'AlertTriangle', accentColor: 'var(--color-error)', trend: { value: failedCount, label: 'başarısız', isPositive: false } },
      { title: 'Uyum Oranı', value: `%${complianceRate}`, icon: 'ShieldCheck', accentColor: complianceRate >= 80 ? 'var(--color-success)' : complianceRate >= 60 ? 'var(--color-warning)' : 'var(--color-error)', trend: { value: compulsoryTrainings.length, label: 'zorunlu eğitim', isPositive: complianceRate >= 80 } },
    ],
    complianceAlerts,
    trendData: await (async () => {
      const result = []
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const monthAssignments = assignments.filter(a => {
          const d = new Date(a.assignedAt)
          return d >= start && d < end
        })
        result.push({
          month: start.toLocaleDateString('tr-TR', { month: 'short' }),
          atanan: monthAssignments.length,
          tamamlanan: monthAssignments.filter(a => a.status === 'passed').length,
          basarisiz: monthAssignments.filter(a => a.status === 'failed').length,
        })
      }
      return result
    })(),
    statusDistribution: [
      { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
      { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
      { name: 'Başarısız', value: failedCount, color: 'var(--color-error)' },
      { name: 'Bekleyen', value: totalAssignments - completedCount - inProgressCount - failedCount, color: 'var(--color-warning)' },
    ],
    departmentComparison,
    overdueTrainings,
    expiringCerts: await (async () => {
      const sixtyDays = new Date(now.getTime() + 60 * 86400000)
      const certs = await prisma.certificate.findMany({
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
      return certs.map(c => {
        const daysLeft = Math.ceil((new Date(c.expiresAt!).getTime() - now.getTime()) / 86400000)
        return {
          name: `${c.user.firstName} ${c.user.lastName}`,
          cert: c.training.title,
          expiryDate: new Date(c.expiresAt!).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          daysLeft,
          status: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'ok',
        }
      })
    })(),
    topPerformers,
    recentActivity,
  })

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('Admin Dashboard', 'Dashboard verileri alınamadı', errMsg)
    return errorResponse(`Dashboard verileri alınamadı: ${errMsg}`, 503)
  }
}
