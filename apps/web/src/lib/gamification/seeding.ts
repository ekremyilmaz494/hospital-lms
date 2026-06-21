/**
 * Leitner havuzu seeding — oyunlaştırma.
 *
 * Bir eğitimin sorularını personelin `DailyReview` havuzuna ekler (box 0, bugün due).
 * `skipDuplicates` + PK `[userId,questionId]` → mevcut Leitner ilerlemesini EZMEZ.
 * Faz 3'te `exam_pass`/`training_complete` olayı doğrulandığında anlık çağrılır;
 * `cron/daily-quiz-push` toplu (batch) seeding yapar.
 */

import { prisma } from '@/lib/prisma'
import { istanbulEndOfDayUTC } from './timezone'

/** Eğitimin sorularını kullanıcının havuzuna seed eder; eklenen satır sayısını döner. */
export async function seedDailyReviewForTraining(
  userId: string,
  organizationId: string,
  trainingId: string,
  now: Date = new Date(),
): Promise<number> {
  const questions = await prisma.question.findMany({
    where: { trainingId },
    select: { id: true },
  })
  if (questions.length === 0) return 0

  const nextReviewAt = istanbulEndOfDayUTC(now)
  const res = await prisma.dailyReview.createMany({
    data: questions.map((q) => ({ userId, questionId: q.id, organizationId, box: 0, nextReviewAt })),
    skipDuplicates: true,
  })
  return res.count
}
