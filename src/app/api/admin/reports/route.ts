import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // Filtre parametreleri
  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const departmentId = searchParams.get('departmentId')
  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  // Atama filtresi
  const assignmentDateFilter = dateFrom || dateTo ? {
    assignedAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  // Departman filtresi
  const userDeptFilter = departmentId ? { departmentId } : {}

  try {
    const [staffCount, trainingCount, assignmentStatusGroups, avgScoreResult, trainings, staff, departments] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true, ...userDeptFilter } }),
      prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { training: { organizationId: orgId }, user: { ...userDeptFilter }, ...assignmentDateFilter },
        _count: true,
      }),
      prisma.examAttempt.aggregate({
        where: { training: { organizationId: orgId }, postExamScore: { not: null }, user: { ...userDeptFilter }, ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}) },
        _avg: { postExamScore: true },
      }),
      // Training-based report
      prisma.training.findMany({
        where: { organizationId: orgId },
        include: {
          assignments: {
            where: { user: { ...userDeptFilter }, ...assignmentDateFilter },
            include: { examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true } } },
          },
          videos: { select: { durationSeconds: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Staff-based report
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff', ...userDeptFilter },
        include: {
          assignments: {
            where: { ...assignmentDateFilter },
            include: { examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, status: true } } },
          },
          departmentRel: { select: { name: true } },
        },
      }),
      // Departments
      prisma.department.findMany({
        where: { organizationId: orgId, ...(departmentId ? { id: departmentId } : {}) },
        include: {
          users: {
            where: { role: 'staff', isActive: true },
            include: {
              assignments: { where: { ...assignmentDateFilter }, select: { status: true } },
            },
          },
        },
      }),
    ])

    const statusMap = Object.fromEntries(assignmentStatusGroups.map(s => [s.status, s._count]))
    const totalAssignments = assignmentStatusGroups.reduce((sum, s) => sum + s._count, 0)
    const passedCount = statusMap['passed'] ?? 0
    const failedCount = statusMap['failed'] ?? 0
    const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0
    const completionRate = totalAssignments > 0 ? Math.round((passedCount / totalAssignments) * 100) : 0

    // Overview stats
    const overviewStats = [
      { title: 'Aktif Eğitim', value: trainingCount, icon: 'GraduationCap', accentColor: 'var(--color-primary)', trend: { value: totalAssignments, label: 'atama', isPositive: true } },
      { title: 'Aktif Personel', value: staffCount, icon: 'Users', accentColor: 'var(--color-info)' },
      { title: 'Başarı Oranı', value: `%${completionRate}`, icon: 'Target', accentColor: 'var(--color-success)', trend: { value: passedCount, label: 'başarılı', isPositive: true } },
      { title: 'Ortalama Puan', value: avgScore, icon: 'Award', accentColor: 'var(--color-accent)', trend: { value: failedCount, label: 'başarısız', isPositive: false } },
    ]

    // Monthly data (last 6 months from assignments)
    const now = new Date()
    const allAssignments = trainings.flatMap(t => t.assignments)
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthAssigns = allAssignments.filter(a => {
        const d = new Date(a.assignedAt)
        return d >= start && d < end
      })
      monthlyData.push({
        month: start.toLocaleDateString('tr-TR', { month: 'short' }),
        tamamlanan: monthAssigns.filter(a => a.status === 'passed').length,
        basarisiz: monthAssigns.filter(a => a.status === 'failed').length,
      })
    }

    // Training-based data
    const trainingData = trainings.map(t => {
      const scores = t.assignments
        .map(a => a.examAttempts[0]?.postExamScore)
        .filter(s => s != null)
        .map(Number)
      return {
        name: t.title,
        atanan: t.assignments.length,
        tamamlayan: t.assignments.filter(a => a.status === 'passed').length,
        basarili: t.assignments.filter(a => a.status === 'passed').length,
        basarisiz: t.assignments.filter(a => a.status === 'failed').length,
        ort: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      }
    })

    // Staff performance
    const staffPerformance = staff.map(s => {
      const completed = s.assignments.filter(a => a.status === 'passed').length
      const scores = s.assignments
        .map(a => a.examAttempts[0]?.postExamScore)
        .filter(sc => sc != null)
        .map(Number)
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const statusLabel = avg >= 80 ? 'Yıldız' : avg >= 50 ? 'Normal' : s.assignments.length > 0 ? 'Risk' : 'Yeni'
      return {
        name: `${s.firstName} ${s.lastName}`,
        dept: s.departmentRel?.name ?? s.department ?? '',
        completed,
        avgScore: avg,
        status: statusLabel,
        color: statusLabel === 'Yıldız' ? 'var(--color-success)' : statusLabel === 'Risk' ? 'var(--color-error)' : 'var(--color-info)',
      }
    })

    // Department data
    const departmentData = departments.map(d => {
      const totalDeptAssignments = d.users.flatMap(u => u.assignments)
      const passedDept = totalDeptAssignments.filter(a => a.status === 'passed').length
      const failedDept = totalDeptAssignments.filter(a => a.status === 'failed').length
      return {
        dept: d.name,
        personel: d.users.length,
        tamamlanma: totalDeptAssignments.length > 0 ? Math.round((passedDept / totalDeptAssignments.length) * 100) : 0,
        ortPuan: 0, // Would need exam scores — simplified
        basarisiz: failedDept,
        color: d.color || 'var(--color-primary)',
      }
    })

    // Failure data
    const failureData = staff.flatMap(s =>
      s.assignments
        .filter(a => a.status === 'failed')
        .map(a => {
          const lastScore = a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : 0
          return {
            assignmentId: a.id,
            name: `${s.firstName} ${s.lastName}`,
            dept: s.departmentRel?.name ?? s.department ?? '',
            training: a.training?.title ?? '',
            attempts: a.examAttempts.length,
            lastScore,
            status: 'failed',
          }
        })
    )

    // Duration data
    const durationData = trainings.map(t => ({
      training: t.title,
      video: t.videos.reduce((sum, v) => sum + v.durationSeconds, 0),
      sinav: (t.examDurationMinutes ?? 30) * 60,
    }))

    return jsonResponse({
      overviewStats,
      monthlyData,
      trainingData,
      staffPerformance,
      departmentData,
      failureData,
      durationData,
    })
  } catch (err) {
    logger.error('Admin Reports', 'Rapor verileri alınamadı', err)
    return errorResponse('Rapor verileri alınamadı', 503)
  }
}
