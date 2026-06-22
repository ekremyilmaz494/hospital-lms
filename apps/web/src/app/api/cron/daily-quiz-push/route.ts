import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendExpoPushToMany } from '@/lib/expo-push'
import { logger } from '@/lib/logger'
import { istanbulEndOfDayUTC } from '@/lib/gamification/timezone'
import {
  DAILY_QUIZ_DEEPLINK,
  CRON_PUSH_BATCH,
  CRON_SEED_INSERT_BATCH,
} from '@/lib/gamification/constants'
import { assertCronAuth } from '@/lib/cron-auth'

const NO_STORE = { 'Cache-Control': 'no-store' }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * GET /api/cron/daily-quiz-push — Günlük "Günün Soruları" cron'u.
 * Vercel Cron: `0 6 * * *` (06:00 UTC = 09:00 Europe/Istanbul; Türkiye DST yok).
 *
 * 1) **SEED:** Sınavını GEÇMİŞ (`ExamAttempt.isPassed`) eğitimlerin sorularını
 *    personelin Leitner havuzuna (`DailyReview`) ekler — `skipDuplicates` ile
 *    mevcut box'ı EZMEZ. Faz 1'de seeding'in TEK noktası burasıdır (GET'te DB
 *    write yasak; Faz 3 event endpoint'i geldiğinde anlık seed devreye girecek).
 * 2) **PUSH:** O gün due (`nextReviewAt <= bugün-sonu`) personele Expo push gönderir
 *    (`data.url = /daily-quiz` deep-link).
 */
export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const now = new Date()
  const dueUntil = istanbulEndOfDayUTC(now)

  // ── 1) SEED — geçilen eğitimlerin soruları havuza ──
  let seeded = 0
  const passedPairs = await prisma.examAttempt.findMany({
    where: { isPassed: true },
    distinct: ['userId', 'trainingId'],
    select: { userId: true, trainingId: true, organizationId: true },
  })

  if (passedPairs.length > 0) {
    const trainingIds = [...new Set(passedPairs.map((p) => p.trainingId))]
    const questions = await prisma.question.findMany({
      where: { trainingId: { in: trainingIds } },
      select: { id: true, trainingId: true },
    })
    const questionsByTraining = new Map<string, string[]>()
    for (const q of questions) {
      const list = questionsByTraining.get(q.trainingId) ?? []
      list.push(q.id)
      questionsByTraining.set(q.trainingId, list)
    }

    const rows: {
      userId: string
      questionId: string
      organizationId: string
      box: number
      nextReviewAt: Date
    }[] = []
    for (const pair of passedPairs) {
      const qIds = questionsByTraining.get(pair.trainingId)
      if (!qIds) continue
      for (const questionId of qIds) {
        rows.push({
          userId: pair.userId,
          questionId,
          organizationId: pair.organizationId,
          box: 0,
          nextReviewAt: dueUntil, // box 0 → bugün due → aynı koşumda push'lanır
        })
      }
    }

    for (const batch of chunk(rows, CRON_SEED_INSERT_BATCH)) {
      const res = await prisma.dailyReview.createMany({ data: batch, skipDuplicates: true })
      seeded += res.count
    }
  }

  // ── 2) PUSH — o gün due personeli bildir ──
  const dueUsers = await prisma.dailyReview.findMany({
    where: { nextReviewAt: { lte: dueUntil } },
    distinct: ['userId'],
    select: { userId: true },
  })
  const userIds = dueUsers.map((u) => u.userId)

  for (const batch of chunk(userIds, CRON_PUSH_BATCH)) {
    await sendExpoPushToMany(batch, {
      title: 'Günün Soruları hazır',
      body: 'Bugünkü tekrarını tamamla, serini koru.',
      url: DAILY_QUIZ_DEEPLINK,
    })
  }

  logger.info('daily-quiz-push', 'Cron tamamlandı', { seeded, pushed: userIds.length })
  return NextResponse.json({ ok: true, seeded, pushed: userIds.length }, { headers: NO_STORE })
}
