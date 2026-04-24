import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
} from '@/lib/api-helpers'
import type { AttemptStatus } from '@/lib/exam-state-machine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  // Tüm sorgular tek Promise.all içinde paralel
  const [exam, attempts, questionStats] = await Promise.all([
    // Sınav detayı
    prisma.training.findFirst({
      where: { id, organizationId: orgId, examOnly: true },
      include: { _count: { select: { questions: true, assignments: true } } },
    }),

    // Tamamlanan denemeler (kullanıcı bilgileriyle)
    prisma.examAttempt.findMany({
      where: { trainingId: id, status: 'completed' satisfies AttemptStatus },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Her soru için doğru cevap istatistiği
    prisma.question.findMany({
      where: { trainingId: id },
      include: {
        examAnswers: {
          where: { examPhase: 'post' },
          select: { isCorrect: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  if (!exam) return errorResponse('Sınav bulunamadı', 404)

  // Departman bazlı atama sayılarını al
  const assignments = await prisma.trainingAssignment.findMany({
    where: { trainingId: id },
    include: {
      user: {
        select: {
          departmentRel: { select: { name: true } },
        },
      },
    },
  })

  // Özet hesaplamaları
  const totalAssigned = exam._count.assignments
  const totalStarted = attempts.length
  const totalCompleted = attempts.filter((a) => a.postExamScore !== null).length
  const totalPassed = attempts.filter((a) => a.isPassed).length
  const totalFailed = totalCompleted - totalPassed
  const scores = attempts
    .map((a) => a.postExamScore)
    .filter((s) => s !== null)
    .map((s) => Number(s))
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

  // Ortalama süre (dakika)
  const durations = attempts
    .filter((a) => a.postExamStartedAt && a.postExamCompletedAt)
    .map((a) => {
      const start = new Date(a.postExamStartedAt!).getTime()
      const end = new Date(a.postExamCompletedAt!).getTime()
      return (end - start) / 60000
    })
  const avgDurationMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0

  const passRate = totalCompleted > 0 ? Math.round((totalPassed / totalCompleted) * 100) : 0

  // Departman istatistikleri
  const deptMap = new Map<string, { totalAssigned: number; passed: number }>()
  for (const a of assignments) {
    const deptName = a.user.departmentRel?.name ?? 'Atanmamış'
    const entry = deptMap.get(deptName) ?? { totalAssigned: 0, passed: 0 }
    entry.totalAssigned++
    deptMap.set(deptName, entry)
  }
  for (const a of attempts) {
    if (a.isPassed) {
      const deptName = a.user.departmentRel?.name ?? 'Atanmamış'
      const entry = deptMap.get(deptName)
      if (entry) entry.passed++
    }
  }
  const departmentStats = Array.from(deptMap.entries()).map(
    ([departmentName, stats]) => ({
      departmentName,
      totalAssigned: stats.totalAssigned,
      passed: stats.passed,
      passRate:
        stats.totalAssigned > 0
          ? Math.round((stats.passed / stats.totalAssigned) * 100)
          : 0,
    }),
  )

  // Soru istatistikleri
  const questionStatsResult = questionStats.map((q) => {
    const totalAnswers = q.examAnswers.length
    const correctCount = q.examAnswers.filter((a) => a.isCorrect).length
    return {
      questionId: q.id,
      questionText: q.questionText,
      correctAnswerRate:
        totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0,
      totalAnswers,
    }
  })

  // Deneme detayları
  const attemptsList = attempts.map((a) => {
    const startedAt = a.postExamStartedAt
    const completedAt = a.postExamCompletedAt
    let durationMinutes = 0
    if (startedAt && completedAt) {
      durationMinutes = Math.round(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
          60000,
      )
    }
    return {
      userId: a.user.id,
      userFullName:
        `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
      department: a.user.departmentRel?.name ?? '',
      attemptNumber: a.attemptNumber,
      postExamScore: a.postExamScore ? Number(a.postExamScore) : null,
      isPassed: a.isPassed,
      startedAt: startedAt?.toISOString() ?? null,
      completedAt: completedAt?.toISOString() ?? null,
      durationMinutes,
    }
  })

  return jsonResponse({
    exam: {
      id: exam.id,
      title: exam.title,
      passingScore: exam.passingScore,
      totalQuestions: exam._count.questions,
      startDate: exam.startDate,
      endDate: exam.endDate,
    },
    summary: {
      totalAssigned,
      totalStarted,
      totalCompleted,
      totalPassed,
      totalFailed,
      avgScore,
      avgDurationMinutes,
      passRate,
    },
    departmentStats,
    questionStats: questionStatsResult,
    attempts: attemptsList,
  })
}
