/**
 * Olay doğrulama (anti-cheat çekirdeği) — oyunlaştırma Faz 3.
 *
 * `POST /gamification/event` mobilden bir başarı olayı bildirir; SUNUCU bunu KENDİ
 * kaydından doğrular — mobilin iddiasına ASLA güvenilmez. Her tip `refId` + `userId`
 * cross-check yapar → başka kullanıcının kaydı sayılamaz. `trainingId` döner (Leitner seeding).
 */

import { prisma } from '@/lib/prisma'

export type GamificationEventType = 'exam_pass' | 'training_complete' | 'feedback_submit'

export interface VerifyResult {
  verified: boolean
  /** Doğrulanan kaydın eğitimi — Leitner havuzu seeding için (null ise seed yok). */
  trainingId: string | null
}

/** Başarı statüleri — `training_complete` için (state machine: POST_EXAM_PASSED → passed). */
const COMPLETED_ASSIGNMENT_STATUSES = ['passed', 'completed']

export async function verifyEvent(
  type: GamificationEventType,
  refId: string,
  userId: string,
  organizationId: string,
): Promise<VerifyResult> {
  switch (type) {
    case 'exam_pass': {
      // Nokta atışı (where.id) + userId/org + isPassed teyidi — resolver gerekmez.
      const attempt = await prisma.examAttempt.findFirst({
        where: { id: refId, userId, organizationId, isPassed: true },
        select: { trainingId: true },
      })
      return { verified: attempt !== null, trainingId: attempt?.trainingId ?? null }
    }
    case 'training_complete': {
      const assignment = await prisma.trainingAssignment.findFirst({
        where: { id: refId, userId, organizationId, status: { in: COMPLETED_ASSIGNMENT_STATUSES } },
        select: { trainingId: true },
      })
      return { verified: assignment !== null, trainingId: assignment?.trainingId ?? null }
    }
    case 'feedback_submit': {
      // userId nullable (anonim feedback) olabilir → sahipliği bağlı attempt üzerinden doğrula.
      const feedback = await prisma.trainingFeedbackResponse.findFirst({
        where: { id: refId, organizationId, attempt: { userId } },
        select: { trainingId: true },
      })
      return { verified: feedback !== null, trainingId: feedback?.trainingId ?? null }
    }
    default:
      return { verified: false, trainingId: null }
  }
}
