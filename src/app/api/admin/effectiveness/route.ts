import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit, getCached, setCached } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/effectiveness
 * Eğitim etkinlik analizi: pre/post sınav karşılaştırma, öğrenme kazanımı, trend
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') === 'weekly' ? 'weekly' : 'monthly'

  const allowed = await checkRateLimit(`effectiveness:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const cacheKey = `effectiveness:${orgId}:${period}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })

  try {
    // Bağımsız sorgular paralel — DB round-trip: 2 → 1
    const [gainAttempts, allAttempts] = await Promise.all([
      // Pre + post skoru olan attempts: öğrenme kazanımını ölçmek için
      prisma.examAttempt.findMany({
        where: {
          training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } },
          preExamScore: { not: null },
          postExamScore: { not: null },
        },
        select: {
          trainingId: true,
          preExamScore: true,
          postExamScore: true,
          postExamCompletedAt: true,
        },
        orderBy: { postExamCompletedAt: 'desc' },
        take: 2000,
      }),
      // Tüm post-exam attempt'leri — pass rate, post-score ort. ve trend bu kaynaktan
      prisma.examAttempt.findMany({
        where: {
          training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } },
          postExamScore: { not: null },
        },
        select: {
          trainingId: true,
          isPassed: true,
          postExamScore: true,
          postExamCompletedAt: true,
          training: {
            select: { title: true, category: true, isCompulsory: true },
          },
        },
        orderBy: { postExamCompletedAt: 'desc' },
        take: 2000,
      }),
    ])

    // Training bazlı gruplama — allAttempts'ten inşa (tüm denemeler dahil)
    const trainingMap = new Map<
      string,
      {
        title: string
        category: string | null
        isCompulsory: boolean
        preScores: number[]
        postScores: number[]
        gains: number[]
        passCount: number
        failCount: number
      }
    >()

    for (const a of allAttempts) {
      const post = Number(a.postExamScore)
      if (!trainingMap.has(a.trainingId)) {
        trainingMap.set(a.trainingId, {
          title: a.training.title,
          category: a.training.category,
          isCompulsory: a.training.isCompulsory,
          preScores: [],
          postScores: [],
          gains: [],
          passCount: 0,
          failCount: 0,
        })
      }
      const entry = trainingMap.get(a.trainingId)!
      entry.postScores.push(post)
      if (a.isPassed) entry.passCount++
      else entry.failCount++
    }

    // Pre+post olan denemeler: sadece öğrenme kazanımı için
    for (const a of gainAttempts) {
      const entry = trainingMap.get(a.trainingId)
      if (!entry) continue // olmamalı ama savunmacı
      const pre = Number(a.preExamScore)
      const post = Number(a.postExamScore)
      entry.preScores.push(pre)
      entry.gains.push(post - pre)
    }

    const avg = (arr: number[]) =>
      arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10

    // Kategori agregasyonunda çift yuvarlama olmasın diye ham passCount'u yan map'te tutuyoruz
    const rawPassCountByTraining = new Map<string, number>()
    const trainingEffectiveness = Array.from(trainingMap.entries()).map(([id, d]) => {
      const total = d.passCount + d.failCount
      const passRate = total > 0 ? Math.round((d.passCount / total) * 100) : 0
      rawPassCountByTraining.set(id, d.passCount)
      return {
        id,
        title: d.title,
        category: d.category,
        isCompulsory: d.isCompulsory,
        avgPreScore: avg(d.preScores),
        avgPostScore: avg(d.postScores),
        avgLearningGain: avg(d.gains),
        passRate,
        totalAttempts: total,
      }
    })

    // Sırala: kazanım (gain) en yüksekten düşüğe
    trainingEffectiveness.sort((a, b) => (b.avgLearningGain ?? 0) - (a.avgLearningGain ?? 0))

    // Genel özet
    const allGains = gainAttempts.map(a => Number(a.postExamScore) - Number(a.preExamScore))
    const allPassCount = allAttempts.filter(a => a.isPassed).length
    const overallPassRate =
      allAttempts.length > 0 ? Math.round((allPassCount / allAttempts.length) * 100) : 0

    // Trend hesaplama — aylık veya haftalık
    function getGroupKey(date: Date): string {
      if (period === 'weekly') {
        // ISO hafta: Pazartesi başlangıç
        const d = new Date(date)
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Pazartesiye git
        return d.toISOString().slice(0, 10) // "YYYY-MM-DD"
      }
      return date.toISOString().slice(0, 7) // "YYYY-MM"
    }
    const sliceCount = period === 'weekly' ? 12 : 6

    const globalGrouped: Record<
      string,
      { pass: number; total: number; sumPost: number; sumGain: number; gainCount: number }
    > = {}

    for (const a of allAttempts) {
      if (!a.postExamCompletedAt) continue
      const key = getGroupKey(a.postExamCompletedAt)
      if (!globalGrouped[key]) globalGrouped[key] = { pass: 0, total: 0, sumPost: 0, sumGain: 0, gainCount: 0 }
      const gm = globalGrouped[key]
      gm.total++
      gm.sumPost += Number(a.postExamScore)
      if (a.isPassed) gm.pass++
    }
    for (const a of gainAttempts) {
      if (!a.postExamCompletedAt) continue
      const key = getGroupKey(a.postExamCompletedAt)
      if (!globalGrouped[key]) continue
      const gm = globalGrouped[key]
      gm.sumGain += Number(a.postExamScore) - Number(a.preExamScore)
      gm.gainCount++
    }

    const globalTrend = Object.entries(globalGrouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-sliceCount)
      .map(([key, gm]) => ({
        month: key,
        passRate: gm.total > 0 ? Math.round((gm.pass / gm.total) * 100) : 0,
        avgPostScore: gm.total > 0 ? Math.round((gm.sumPost / gm.total) * 10) / 10 : 0,
        avgGain: gm.gainCount > 0 ? Math.round((gm.sumGain / gm.gainCount) * 10) / 10 : null,
        attemptCount: gm.total,
      }))

    // Kategori bazlı özet — ham passCount ile, çift yuvarlama drift'i olmadan
    const categoryMap: Record<
      string,
      { count: number; sumGain: number; gainCount: number; pass: number; total: number }
    > = {}
    for (const t of trainingEffectiveness) {
      const cat = t.category ?? 'Diğer'
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, sumGain: 0, gainCount: 0, pass: 0, total: 0 }
      categoryMap[cat].count++
      categoryMap[cat].total += t.totalAttempts
      categoryMap[cat].pass += rawPassCountByTraining.get(t.id) ?? 0
      if (t.avgLearningGain !== null) {
        categoryMap[cat].sumGain += t.avgLearningGain
        categoryMap[cat].gainCount++
      }
    }
    const categoryBreakdown = Object.entries(categoryMap).map(([category, d]) => ({
      category,
      trainingCount: d.count,
      totalAttempts: d.total,
      passRate: d.total > 0 ? Math.round((d.pass / d.total) * 100) : 0,
      avgGain: d.gainCount > 0 ? Math.round((d.sumGain / d.gainCount) * 10) / 10 : null,
    }))

    const responseData = {
      summary: {
        totalTrainingsAnalyzed: trainingEffectiveness.length,
        totalAttempts: allAttempts.length,
        overallPassRate,
        avgLearningGain: avg(allGains),
      },
      globalTrend,
      categoryBreakdown,
      trainingEffectiveness,
    }

    await setCached(cacheKey, responseData, 300) // 5 dk TTL
    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Effectiveness', 'Etkinlik analizi alınamadı', err)
    return errorResponse('Etkinlik analizi alınamadı', 503)
  }
}
