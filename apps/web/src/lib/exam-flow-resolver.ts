import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import {
  attemptPhaseRedirect,
  type AttemptStatus,
  type AssignmentStatus,
  type ExamRoute,
} from '@/lib/exam-state-machine'

/* ──────────────────────────────────────────────────────────────────────
   SINAV AKIŞI ÇÖZÜMLEYİCİ — "kullanıcı hangi atamada + hangi denemede +
   hangi aşamada?" sorusunun TEK doğruluk kaynağı.

   NEDEN VAR (Haziran 2026 kök neden analizi):
   Bu soru daha önce 6+ route'ta kopya sorgularla cevaplanıyordu ve hepsi
   trainingId fallback'inde `orderBy: { attemptNumber: 'desc' }` kullanıyordu.
   `attemptNumber` atama-BAŞINA benzersizdir (@@unique([assignmentId,
   attemptNumber])); atamalar-ARASI sıralamada anlamı yoktur. "Yeniden Ata"
   (round 2+) senaryosunda eski atamanın 3. denemesi (pre_exam'da takılı),
   yeni atamanın 1. denemesini (watching_videos) gölgeliyordu → personel ön
   sınavı bitirmişken tekrar ön sınava atılıyordu.

   KURALLAR:
   1. Önce ATAMA çözülür (id → assignmentId, yoksa trainingId fallback'i
      non-terminal öncelikli + `round desc, assignedAt desc`).
   2. Attempt HER ZAMAN o atamaya scope'lanır; attemptNumber sıralaması
      yalnız tek atama içinde kullanılır (orada güvenli).
   3. Atamalar-arası attemptNumber sıralaması YASAK.
   4. Aktif (non-terminal) attempt önceliklidir; yoksa son attempt'e
      (terminal dahil) düşülür — taze attempt'i eski terminal attempt'in
      arkasına gizleme (2026-05-20 Devakent incident semantiği).

   Bu modül SALT-OKUNURDUR — transition'lar exam-state-machine.ts'te,
   mutation'lar route'larda kalır.
   ────────────────────────────────────────────────────────────────────── */

// Not: `as const` koyma — Prisma `notIn` mutable string[] bekliyor.
const ATTEMPT_ACTIVE_FILTER = { status: { notIn: ['completed', 'expired'] } }

const ASSIGNMENT_TERMINAL: AssignmentStatus[] = ['passed', 'failed', 'locked']

const ATTEMPT_SELECT = {
  id: true,
  assignmentId: true,
  trainingId: true,
  status: true,
  attemptNumber: true,
  preExamStartedAt: true,
  preExamCompletedAt: true,
  preExamScore: true,
  videosCompletedAt: true,
  postExamStartedAt: true,
  postExamCompletedAt: true,
  isPassed: true,
  createdAt: true,
} satisfies Prisma.ExamAttemptSelect

const ASSIGNMENT_SELECT = {
  id: true,
  trainingId: true,
  status: true,
  currentAttempt: true,
  maxAttempts: true,
  round: true,
  dueDate: true,
} satisfies Prisma.TrainingAssignmentSelect

export type ExamFlowAttempt = Prisma.ExamAttemptGetPayload<{ select: typeof ATTEMPT_SELECT }>
export type ExamFlowAssignment = Prisma.TrainingAssignmentGetPayload<{ select: typeof ASSIGNMENT_SELECT }>

export type ExamFlowStage = AttemptStatus | 'none'

export interface ExamFlowState {
  /** Kanonik atama — id ister assignmentId ister trainingId olsun bulunur. */
  assignment: ExamFlowAssignment | null
  /** Atamaya scope'lu aktif attempt; aktif yoksa son attempt (terminal dahil). */
  attempt: ExamFlowAttempt | null
  /**
   * SADECE non-terminal attempt (completed/expired hariç) — progress yazımı
   * ve faz guard'ları bunu kullanmalı; `attempt` ise UI/redirect için
   * (terminal status da görünür olmalı: "Yeniden Dene" CTA'sı, sonuç ekranı).
   */
  activeAttempt: ExamFlowAttempt | null
  /** attempt.status veya hiç attempt yoksa 'none'. */
  stage: ExamFlowStage
  /** Son sınav kapısını tetikleyen içerik sayısı (video/ses; PDF hariç). */
  requiredVideoCount: number
  /**
   * watching_videos aşamasında zorunlu içerik yok — çağıran
   * `advancePastVideosIfNoneRequired` ile ilerletmeli ve UI'da
   * açıkça belirtmeli (sessiz atlama YASAK).
   */
  noRequiredVideos: boolean
  /**
   * `opts.currentRoute` verildiyse: kullanıcı yanlış sayfadaysa gitmesi
   * gereken route; doğru sayfadaysa null. Verilmediyse null.
   */
  redirect: ExamRoute | null
}

export interface ResolveExamFlowOptions {
  /** Verilirse `redirect` hesaplanır (attemptPhaseRedirect). */
  currentRoute?: ExamRoute
  /** Transaction içinden çağrı (örn. start route'un FOR UPDATE bloğu). */
  tx?: Prisma.TransactionClient
}

/**
 * Sınav akışı durumunu çözer. Tüm exam route'ları ve sayfaları attempt/aşama
 * tespitini BU fonksiyonla yapmalı — `prisma.examAttempt.findFirst`'ü doğrudan
 * çağırma (kopya sorgu = drift = tekrarlayan akış bug'ları).
 *
 * @param id assignmentId VEYA trainingId (içeride kanonikleştirilir)
 * @param userId personelin user id'si
 * @param organizationId tenant guard — her sorguda zorunlu
 */
export async function resolveExamFlowState(
  id: string,
  userId: string,
  organizationId: string,
  opts?: ResolveExamFlowOptions,
): Promise<ExamFlowState> {
  const db = opts?.tx ?? prisma

  // 1) Atamayı kanonikleştir: önce assignmentId olarak dene.
  let assignment = await db.trainingAssignment.findFirst({
    where: { id, userId, organizationId },
    select: ASSIGNMENT_SELECT,
  })

  // 2) trainingId fallback'i: aynı eğitimde birden çok atama (round) olabilir.
  //    Non-terminal atama önceliklidir; round desc + assignedAt desc deterministik
  //    olarak EN YENİ turu seçer ("Yeniden Ata" senaryosunun doğru cevabı).
  if (!assignment) {
    assignment = await db.trainingAssignment.findFirst({
      where: { trainingId: id, userId, organizationId, status: { notIn: ASSIGNMENT_TERMINAL } },
      orderBy: [{ round: 'desc' }, { assignedAt: 'desc' }],
      select: ASSIGNMENT_SELECT,
    })
  }
  if (!assignment) {
    assignment = await db.trainingAssignment.findFirst({
      where: { trainingId: id, userId, organizationId },
      orderBy: [{ round: 'desc' }, { assignedAt: 'desc' }],
      select: ASSIGNMENT_SELECT,
    })
  }

  if (!assignment) {
    return {
      assignment: null,
      attempt: null,
      activeAttempt: null,
      stage: 'none',
      requiredVideoCount: 0,
      noRequiredVideos: false,
      redirect: opts?.currentRoute && opts.currentRoute !== 'my-trainings' ? 'my-trainings' : null,
    }
  }

  // 3) Attempt'i ATAMAYA scope'la. attemptNumber sıralaması tek atama içinde
  //    güvenli (@@unique[assignmentId, attemptNumber]). Aktif öncelikli.
  const [activeAttempt, requiredVideoCount] = await Promise.all([
    db.examAttempt.findFirst({
      where: { assignmentId: assignment.id, userId, organizationId, ...ATTEMPT_ACTIVE_FILTER },
      orderBy: { attemptNumber: 'desc' },
      select: ATTEMPT_SELECT,
    }),
    db.trainingVideo.count({
      where: { trainingId: assignment.trainingId, contentType: { not: 'pdf' } },
    }),
  ])

  // 4) Aktif yoksa son attempt (terminal dahil) — "Yeniden Dene" CTA'sı ve
  //    sonuç ekranı için terminal status görünür olmalı.
  const attempt =
    activeAttempt ??
    (await db.examAttempt.findFirst({
      where: { assignmentId: assignment.id, userId, organizationId },
      orderBy: { attemptNumber: 'desc' },
      select: ATTEMPT_SELECT,
    }))

  const stage: ExamFlowStage = attempt ? (attempt.status as AttemptStatus) : 'none'

  const redirect = opts?.currentRoute
    ? attempt
      ? attemptPhaseRedirect(attempt.status as AttemptStatus, opts.currentRoute)
      : opts.currentRoute === 'pre-exam'
        ? null
        : 'pre-exam' // hiç attempt yok — akış pre-exam'da başlar (POST /start orada)
    : null

  return {
    assignment,
    attempt,
    activeAttempt,
    stage,
    requiredVideoCount,
    noRequiredVideos: stage === 'watching_videos' && requiredVideoCount === 0,
    redirect,
  }
}
