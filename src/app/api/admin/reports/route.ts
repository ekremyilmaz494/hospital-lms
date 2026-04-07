import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit, getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // Rate limit: dakikada 10 rapor sorgusu (ağır aggregation — DoS koruması)
  const allowed = await checkRateLimit(`reports:${orgId}`, 10, 60)
  if (!allowed) return errorResponse('Çok fazla rapor sorgusu. Lütfen bir dakika bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const departmentId = searchParams.get('departmentId')

  // Redis cache: 10 dk TTL (filtre parametreleri cache key'e dahil)
  const cacheKey = `reports:${orgId}:${fromParam ?? 'all'}:${toParam ?? 'all'}:${departmentId ?? 'all'}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  // Atama filtresi
  const assignmentDateFilter = dateFrom || dateTo ? {
    assignedAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  // Departman filtresi — departmentId'nin bu organizasyona ait olduğunu doğrula
  let validatedDeptId: string | undefined
  if (departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
      select: { id: true },
    })
    if (!dept) return errorResponse('Departman bulunamadı veya bu organizasyona ait değil', 403)
    validatedDeptId = dept.id
  }
  const userDeptFilter = validatedDeptId ? { departmentId: validatedDeptId } : {}

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
      // Training-based report (max 500 — DoS koruması)
      prisma.training.findMany({
        where: { organizationId: orgId },
        include: {
          assignments: {
            where: { user: { ...userDeptFilter }, ...assignmentDateFilter },
            include: { examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, preExamScore: true, isPassed: true } } },
          },
          videos: { select: { durationSeconds: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      // Staff-based report (max 2000 — DoS koruması)
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff', ...userDeptFilter },
        include: {
          assignments: {
            where: { ...assignmentDateFilter },
            include: { training: { select: { title: true } }, examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, status: true } } },
          },
          departmentRel: { select: { name: true } },
        },
        take: 2000,
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
    const assignmentsWithDates = allAssignments.map(a => ({ ...a, date: new Date(a.assignedAt) }))
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthAssigns = assignmentsWithDates.filter(a => a.date >= start && a.date < end)
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
        dept: s.departmentRel?.name ?? '',
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
            dept: s.departmentRel?.name ?? '',
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

    // G6.5 — Pre/post score comparison per training
    const scoreComparisonData = trainings
      .map(t => {
        const preScores = t.assignments
          .map(a => a.examAttempts[0]?.preExamScore)
          .filter(s => s != null)
          .map(Number)
        const postScores = t.assignments
          .map(a => a.examAttempts[0]?.postExamScore)
          .filter(s => s != null)
          .map(Number)
        const preScore = preScores.length > 0 ? Math.round(preScores.reduce((a, b) => a + b, 0) / preScores.length) : 0
        const postScore = postScores.length > 0 ? Math.round(postScores.reduce((a, b) => a + b, 0) / postScores.length) : 0
        return {
          training: t.title.length > 30 ? t.title.slice(0, 30) + '…' : t.title,
          fullTitle: t.title,
          preScore,
          postScore,
          improvement: postScore - preScore,
          sampleSize: postScores.length,
        }
      })
      .filter(d => d.sampleSize > 0)

    const responseData = {
      overviewStats,
      monthlyData,
      trainingData,
      staffPerformance,
      departmentData,
      failureData,
      durationData,
      scoreComparisonData,
    }

    await setCached(cacheKey, responseData, 600) // 10 dk TTL
    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Admin Reports', 'Rapor verileri alınamadı', err)
    return errorResponse('Rapor verileri alınamadı', 503)
  }
}
