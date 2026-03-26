import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  try {

  // Parallel queries for dashboard data
  const [
    staffCount,
    activeStaffCount,
    trainingCount,
    activeTrainingCount,
    assignments,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
    prisma.training.count({ where: { organizationId: orgId } }),
    prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.trainingAssignment.findMany({
      where: { training: { organizationId: orgId } },
      include: {
        user: { select: { firstName: true, lastName: true, department: true } },
        training: { select: { title: true, category: true, endDate: true } },
        examAttempts: { select: { postExamScore: true, preExamScore: true, isPassed: true, status: true }, orderBy: { attemptNumber: 'desc' }, take: 1 },
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Calculate stats from assignments
  const completedCount = assignments.filter(a => a.status === 'completed').length
  const failedCount = assignments.filter(a => a.status === 'failed').length
  const inProgressCount = assignments.filter(a => a.status === 'in_progress').length
  const totalAssignments = assignments.length
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

  // Overdue trainings (training endDate passed but assignment not completed)
  const now = new Date()
  const overdueTrainings = assignments
    .filter(a => a.status !== 'completed' && a.training && a.training.endDate && new Date(a.training.endDate) < now)
    .slice(0, 5)
    .map(a => ({
      name: `${a.user.firstName} ${a.user.lastName}`,
      dept: a.user.department ?? '',
      training: a.training.title,
      dueDate: new Date(a.training.endDate).toISOString().split('T')[0],
      daysOverdue: Math.floor((now.getTime() - new Date(a.training.endDate).getTime()) / 86400000),
      color: 'var(--color-error)',
    }))

  // Top performers (highest scores)
  const performerMap = new Map<string, { name: string; department: string; scores: number[]; courses: number; initials: string }>()
  for (const a of assignments) {
    if (a.status !== 'completed') continue
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
        department: a.user.department ?? '',
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
    const dept = a.user.department ?? 'Diğer'
    const existing = deptMap.get(dept) ?? { total: 0, completed: 0, scores: [] }
    existing.total++
    if (a.status === 'completed') {
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
    ],
    trendData: [],
    statusDistribution: [
      { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
      { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
      { name: 'Başarısız', value: failedCount, color: 'var(--color-error)' },
      { name: 'Bekleyen', value: totalAssignments - completedCount - inProgressCount - failedCount, color: 'var(--color-warning)' },
    ],
    departmentComparison,
    overdueTrainings,
    expiringCerts: [],
    topPerformers,
    recentActivity,
  })

  } catch (err) {
    console.error('[Dashboard API Error]', err)
    return errorResponse('Dashboard verileri alınamadı, lütfen sayfayı yenileyin', 503)
  }
}
