import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/effectiveness
 * Eğitim etkinlik analizi: pre/post sınav karşılaştırma, öğrenme kazanımı, trend
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`effectiveness:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  try {
    // Tüm geçerli attempts (pre + post skoru olan): öğrenme kazanımını ölçmek için
    const attempts = await prisma.examAttempt.findMany({
      where: {
        training: { organizationId: orgId },
        preExamScore: { not: null },
        postExamScore: { not: null },
      },
      select: {
        trainingId: true,
        attemptNumber: true,
        preExamScore: true,
        postExamScore: true,
        isPassed: true,
        postExamCompletedAt: true,
        training: {
          select: { title: true, category: true, isCompulsory: true },
        },
      },
      orderBy: { postExamCompletedAt: 'asc' },
    })

    // Tüm attempt'ler (pass rate için — sadece pre skoru olan veya post olmayan dahil)
    const allAttempts = await prisma.examAttempt.findMany({
      where: {
        training: { organizationId: orgId },
        postExamScore: { not: null },
      },
      select: {
        trainingId: true,
        isPassed: true,
        postExamScore: true,
        postExamCompletedAt: true,
      },
    })

    // Training bazlı gruplama
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
        monthlyData: Record<string, { pass: number; fail: number; avgPost: number; count: number }>
      }
    >()

    for (const a of attempts) {
      const pre = Number(a.preExamScore)
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
          monthlyData: {},
        })
      }

      const entry = trainingMap.get(a.trainingId)!
      entry.preScores.push(pre)
      entry.postScores.push(post)
      entry.gains.push(post - pre)
      if (a.isPassed) entry.passCount++
      else entry.failCount++

      // Aylık trend
      if (a.postExamCompletedAt) {
        const month = a.postExamCompletedAt.toISOString().slice(0, 7) // "YYYY-MM"
        if (!entry.monthlyData[month]) {
          entry.monthlyData[month] = { pass: 0, fail: 0, avgPost: 0, count: 0 }
        }
        const md = entry.monthlyData[month]
        md.count++
        md.avgPost = md.avgPost + (post - md.avgPost) / md.count // running avg
        if (a.isPassed) md.pass++
        else md.fail++
      }
    }

    // Pass rate için allAttempts de ekle (pre skoru olmayan denemeler için)
    for (const a of allAttempts) {
      if (!trainingMap.has(a.trainingId)) continue // zaten yukarıda eklenmişse atla
      // sadece aylık trend için
    }

    const avg = (arr: number[]) =>
      arr.length === 0 ? null : Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10

    const trainingEffectiveness = Array.from(trainingMap.entries()).map(([id, d]) => {
      const total = d.passCount + d.failCount
      const passRate = total > 0 ? Math.round((d.passCount / total) * 100) : 0
      const avgPre = avg(d.preScores)
      const avgPost = avg(d.postScores)
      const avgGain = avg(d.gains)

      const monthlyTrend = Object.entries(d.monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, md]) => ({
          month,
          passRate: md.count > 0 ? Math.round((md.pass / md.count) * 100) : 0,
          avgPostScore: Math.round(md.avgPost * 10) / 10,
          attemptCount: md.count,
        }))

      return {
        id,
        title: d.title,
        category: d.category,
        isCompulsory: d.isCompulsory,
        avgPreScore: avgPre,
        avgPostScore: avgPost,
        avgLearningGain: avgGain,
        passRate,
        totalAttempts: total,
        monthlyTrend,
      }
    })

    // Sırala: kazanım (gain) en yüksekten düşüğe
    trainingEffectiveness.sort((a, b) => (b.avgLearningGain ?? 0) - (a.avgLearningGain ?? 0))

    // Genel özet
    const allGains = attempts.map(a => Number(a.postExamScore) - Number(a.preExamScore))
    const allPassCount = allAttempts.filter(a => a.isPassed).length
    const overallPassRate =
      allAttempts.length > 0 ? Math.round((allPassCount / allAttempts.length) * 100) : 0

    // Son 6 ay trend — tüm eğitimler için
    const globalMonthly: Record<
      string,
      { pass: number; total: number; sumPost: number; sumGain: number; gainCount: number }
    > = {}

    for (const a of allAttempts) {
      if (!a.postExamCompletedAt) continue
      const month = a.postExamCompletedAt.toISOString().slice(0, 7)
      if (!globalMonthly[month]) globalMonthly[month] = { pass: 0, total: 0, sumPost: 0, sumGain: 0, gainCount: 0 }
      const gm = globalMonthly[month]
      gm.total++
      gm.sumPost += Number(a.postExamScore)
      if (a.isPassed) gm.pass++
    }
    for (const a of attempts) {
      if (!a.postExamCompletedAt) continue
      const month = a.postExamCompletedAt.toISOString().slice(0, 7)
      if (!globalMonthly[month]) continue
      const gm = globalMonthly[month]
      gm.sumGain += Number(a.postExamScore) - Number(a.preExamScore)
      gm.gainCount++
    }

    const globalTrend = Object.entries(globalMonthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // son 6 ay
      .map(([month, gm]) => ({
        month,
        passRate: gm.total > 0 ? Math.round((gm.pass / gm.total) * 100) : 0,
        avgPostScore: gm.total > 0 ? Math.round((gm.sumPost / gm.total) * 10) / 10 : 0,
        avgGain: gm.gainCount > 0 ? Math.round((gm.sumGain / gm.gainCount) * 10) / 10 : null,
        attemptCount: gm.total,
      }))

    // Kategori bazlı özet
    const categoryMap: Record<
      string,
      { count: number; sumGain: number; gainCount: number; pass: number; total: number }
    > = {}
    for (const t of trainingEffectiveness) {
      const cat = t.category ?? 'Diğer'
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, sumGain: 0, gainCount: 0, pass: 0, total: 0 }
      categoryMap[cat].count++
      categoryMap[cat].total += t.totalAttempts
      categoryMap[cat].pass += Math.round(t.passRate * t.totalAttempts / 100)
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

    return NextResponse.json({
      summary: {
        totalTrainingsAnalyzed: trainingEffectiveness.length,
        totalAttempts: allAttempts.length,
        overallPassRate,
        avgLearningGain: avg(allGains),
      },
      globalTrend,
      categoryBreakdown,
      trainingEffectiveness,
    })
  } catch (err) {
    logger.error('Effectiveness', 'Etkinlik analizi alınamadı', err)
    return errorResponse('Etkinlik analizi alınamadı', 503)
  }
}
