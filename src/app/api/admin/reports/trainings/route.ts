import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { resolveReportFilters, REPORTS_CACHE_HEADERS, TRAINING_CAP } from '../_shared'
// Cache-Control: private, max-age=30, stale-while-revalidate=60 (REPORTS_CACHE_HEADERS)

/**
 * Eğitim bazlı rapor — trainingData, monthlyData, scoreComparisonData, durationData.
 * "Eğitim Bazlı" + "Skor Analizi" + "Süre Analizi" tab'ları için kullanılır.
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const orgId = organizationId

  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const { trainingScope, userDeptFilter, assignmentDateFilter } = resolved.filters

  try {
    const [trainings, trainingCount] = await Promise.all([
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
              examAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
                select: { postExamScore: true, preExamScore: true, isPassed: true, attemptNumber: true },
              },
            },
          },
          videos: { select: { durationSeconds: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: TRAINING_CAP,
      }),
      prisma.training.count({ where: trainingScope }),
    ])

    // Monthly trend (last 6 months)
    const now = new Date()
    const allAssignments = trainings.flatMap(t => t.assignments).map(a => ({ ...a, date: new Date(a.assignedAt) }))
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthAssigns = allAssignments.filter(a => a.date >= start && a.date < end)
      monthlyData.push({
        month: start.toLocaleDateString('tr-TR', { month: 'short' }),
        tamamlanan: monthAssigns.filter(a => a.status === 'passed').length,
        basarisiz: monthAssigns.filter(a => a.status === 'failed').length,
      })
    }

    // Per-training breakdown
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

    // Pre/post score comparison
    const scoreComparisonData = trainings
      .map(t => {
        const preScores = t.assignments.map(a => a.examAttempts[0]?.preExamScore).filter(s => s != null).map(Number)
        const postScores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
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

    // Duration breakdown — dakika cinsinden
    const durationData = trainings.map(t => ({
      training: t.title,
      video: Math.round(t.videos.reduce((sum, v) => sum + v.durationSeconds, 0) / 60),
      sinav: t.examDurationMinutes ?? 30,
    }))

    const truncated = trainingCount > TRAINING_CAP
      ? { shown: trainings.length, total: trainingCount }
      : null

    return jsonResponse(
      { trainingData, monthlyData, scoreComparisonData, durationData, truncated },
      200,
      REPORTS_CACHE_HEADERS,
    )
  } catch (err) {
    logger.error('Admin Reports/trainings', 'Eğitim raporu alınamadı', err)
    return errorResponse('Eğitim raporu alınamadı', 503)
  }
}, { requireOrganization: true })
