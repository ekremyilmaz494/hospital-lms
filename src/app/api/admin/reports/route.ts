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
    // Archived/inactive training'ler raporlardan dışarı — atama sayımları, ortalamalar ve listeler etkilenmemeli
    const trainingScope = { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } }

    // DoS koruması — kapasite aşılırsa UI'da uyarı göster
    const TRAINING_CAP = 500
    const STAFF_CAP = 2000

    const [staffCount, trainingCount, totalStaffForCap, assignmentStatusGroups, avgScoreResult, trainings, staff, departments, availableDepartments] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true, ...userDeptFilter } }),
      prisma.training.count({ where: trainingScope }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', ...userDeptFilter } }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { training: trainingScope, user: { ...userDeptFilter }, ...assignmentDateFilter },
        _count: true,
      }),
      prisma.examAttempt.aggregate({
        where: { training: trainingScope, postExamScore: { not: null }, user: { ...userDeptFilter }, ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}) },
        _avg: { postExamScore: true },
      }),
      // Training-based report (max 500 — DoS koruması)
      prisma.training.findMany({
        where: trainingScope,
        select: {
          id: true,
          title: true,
          maxAttempts: true,
          examDurationMinutes: true,
          assignments: {
            where: { user: { ...userDeptFilter }, ...assignmentDateFilter },
            select: {
              id: true,
              status: true,
              assignedAt: true,
              examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, preExamScore: true, isPassed: true, attemptNumber: true } },
            },
          },
          videos: { select: { durationSeconds: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: TRAINING_CAP,
      }),
      // Staff-based report (max 2000 — DoS koruması)
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff', ...userDeptFilter },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentRel: { select: { name: true } },
          assignments: {
            where: { ...assignmentDateFilter, training: { isActive: true, publishStatus: { not: 'archived' } } },
            select: {
              id: true,
              status: true,
              training: { select: { title: true, maxAttempts: true } },
              examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, status: true, attemptNumber: true } },
            },
          },
        },
        take: STAFF_CAP,
      }),
      // Departments — exam score'ları da gerekli (ortPuan hesabı için)
      prisma.department.findMany({
        where: { organizationId: orgId, ...(departmentId ? { id: departmentId } : {}) },
        select: {
          id: true,
          name: true,
          color: true,
          users: {
            where: { role: 'staff', isActive: true },
            select: {
              assignments: {
                where: { ...assignmentDateFilter, training: { isActive: true, publishStatus: { not: 'archived' } } },
                select: {
                  status: true,
                  examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true } },
                },
              },
            },
          },
        },
      }),
      // Departman seçici için
      prisma.department.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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

    // Staff performance — status key'leri semantic (İngilizce); UI display ayrı karar verir
    // 'new' = atama var ama henüz sınava girmemiş (score yok) → risk sayılmaz
    // 'risk' = SADECE sınava girmiş ve düşük puan almış olanlar
    const STAR_MIN = 80
    const NORMAL_MIN = 50
    const staffPerformance = staff.map(s => {
      const completed = s.assignments.filter(a => a.status === 'passed').length
      const scores = s.assignments
        .map(a => a.examAttempts[0]?.postExamScore)
        .filter(sc => sc != null)
        .map(Number)
      const hasScores = scores.length > 0
      const avg = hasScores ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      let statusKey: 'star' | 'normal' | 'risk' | 'new'
      if (!hasScores) statusKey = 'new'
      else if (avg >= STAR_MIN) statusKey = 'star'
      else if (avg >= NORMAL_MIN) statusKey = 'normal'
      else statusKey = 'risk'
      return {
        name: `${s.firstName} ${s.lastName}`,
        dept: s.departmentRel?.name ?? '',
        completed,
        avgScore: avg,
        status: statusKey,
        color: statusKey === 'star' ? 'var(--color-success)' : statusKey === 'risk' ? 'var(--color-error)' : 'var(--color-info)',
      }
    })

    // Department data — ortPuan gerçekten hesaplanıyor
    const departmentData = departments.map(d => {
      const totalDeptAssignments = d.users.flatMap(u => u.assignments)
      const passedDept = totalDeptAssignments.filter(a => a.status === 'passed').length
      const failedDept = totalDeptAssignments.filter(a => a.status === 'failed').length
      const deptScores = totalDeptAssignments
        .map(a => a.examAttempts[0]?.postExamScore)
        .filter(s => s != null)
        .map(Number)
      const ortPuan = deptScores.length > 0
        ? Math.round(deptScores.reduce((a, b) => a + b, 0) / deptScores.length)
        : 0
      return {
        dept: d.name,
        personel: d.users.length,
        tamamlanma: totalDeptAssignments.length > 0 ? Math.round((passedDept / totalDeptAssignments.length) * 100) : 0,
        ortPuan,
        basarisiz: failedDept,
        color: d.color || 'var(--color-primary)',
      }
    })

    // Failure data — attempts gerçek attemptNumber, locked status maxAttempts'a göre
    const failureData = staff.flatMap(s =>
      s.assignments
        .filter(a => a.status === 'failed')
        .map(a => {
          const lastAttempt = a.examAttempts[0]
          const attemptsUsed = lastAttempt?.attemptNumber ?? 0
          const maxAttempts = a.training?.maxAttempts ?? 3
          const lastScore = lastAttempt?.postExamScore ? Number(lastAttempt.postExamScore) : 0
          return {
            assignmentId: a.id,
            name: `${s.firstName} ${s.lastName}`,
            dept: s.departmentRel?.name ?? '',
            training: a.training?.title ?? '',
            attempts: attemptsUsed,
            maxAttempts,
            lastScore,
            status: attemptsUsed >= maxAttempts ? 'locked' : 'failed',
          }
        })
    )

    // Duration data — dakika cinsinden (video seconds → minutes, sınav zaten dakika)
    const durationData = trainings.map(t => ({
      training: t.title,
      video: Math.round(t.videos.reduce((sum, v) => sum + v.durationSeconds, 0) / 60),
      sinav: t.examDurationMinutes ?? 30,
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

    // Truncation uyarısı — UI banner'da gösterilir
    const truncated = {
      trainings: trainingCount > TRAINING_CAP ? { shown: trainings.length, total: trainingCount } : null,
      staff: totalStaffForCap > STAFF_CAP ? { shown: staff.length, total: totalStaffForCap } : null,
    }

    const responseData = {
      overviewStats,
      monthlyData,
      trainingData,
      staffPerformance,
      departmentData,
      failureData,
      durationData,
      scoreComparisonData,
      availableDepartments,
      truncated,
    }

    await setCached(cacheKey, responseData, 600) // 10 dk TTL
    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Admin Reports', 'Rapor verileri alınamadı', err)
    return errorResponse('Rapor verileri alınamadı', 503)
  }
}
