import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { resolveExamFlowState } from '@/lib/exam-flow-resolver'
import type { AttemptStatus } from '@/lib/exam-state-machine'

/**
 * Get an active exam attempt and verify the user is in the required phase.
 * Returns the attempt or an error response.
 *
 * Attempt tespiti resolveExamFlowState üzerinden yapılır (tek doğruluk kaynağı):
 * atama önce kanonikleştirilir, attempt o atamaya scope'lanır. Eski
 * `status: { not: 'completed' }` filtresi expired attempt'i AKTİF sayıyordu
 * (N3) — artık yalnız non-terminal attempt faz kontrolüne girer.
 */
export async function getAttemptWithPhaseCheck(
  id: string,
  userId: string,
  requiredPhase: string | string[],
  userOrgId: string | string[], // tek org (klasik) VEYA ortak personel org seti (getStaffOrgIds)
) {
  const flow = await resolveExamFlowState(id, userId, userOrgId)
  // Tek org → eşitlik (birebir eski davranış); dizi → { in: [...] } (ortak personel, çok-hastaneli grup).
  const orgFilter = Array.isArray(userOrgId) ? { in: userOrgId } : userOrgId

  if (!flow.activeAttempt) {
    return { attempt: null, error: errorResponse('Aktif sınav denemesi bulunamadı', 404) }
  }

  // Faz kontrolünden geçecek tam kayıt (training + videoProgress include'ları
  // çağıranların ihtiyacı) — id ile nokta atışı, tenant guard korunur.
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: flow.activeAttempt.id, userId, training: { organizationId: orgFilter } },
    include: {
      training: { select: { id: true, passingScore: true, examDurationMinutes: true } },
      videoProgress: true,
    },
  })

  if (!attempt) {
    return { attempt: null, error: errorResponse('Aktif sınav denemesi bulunamadı', 404) }
  }

  const phases = Array.isArray(requiredPhase) ? requiredPhase : [requiredPhase]

  if (!phases.includes(attempt.status)) {
    // Return correct redirect info
    const redirectMap: Record<string, string> = {
      pre_exam: 'pre-exam',
      watching_videos: 'videos',
      post_exam: 'post-exam',
    }
    const redirect = redirectMap[attempt.status] || 'pre-exam'

    return {
      attempt: null,
      error: errorResponse(
        JSON.stringify({ message: 'Bu işlem şu anki aşamada yapılamaz', currentPhase: attempt.status, redirect }),
        403,
      ),
    }
  }

  return { attempt, error: null }
}

/*
 * NOT: getAttemptStatus ve getActiveOrLatestAttemptStatus KALDIRILDI
 * (Haziran 2026 kök neden temizliği). İkisi de trainingId fallback'inde
 * atamalar-ARASI `attemptNumber desc` sıralıyordu; attemptNumber atama-başına
 * benzersiz olduğundan "Yeniden Ata" round'larında eski atamanın denemesi
 * yenisini gölgeliyordu (personel ön sınava geri atılıyordu). Yerine:
 * `resolveExamFlowState` (exam-flow-resolver.ts) — attempt tespitinin tek
 * doğruluk kaynağı. Bu fonksiyonları GERİ EKLEME.
 */

/* ──────────────────────────────────────────────────────────────────────
   Soru subset seçimi — questions ve submit route'ları aynı kümeyi görmeli.
   Aksi halde randomQuestionCount aktifken kullanıcı 5 soru görür, submit
   10 soru üzerinden puanlar (gösterilmeyen 5 = yanlış sayılır).
   ────────────────────────────────────────────────────────────────────── */

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function stringToSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = seededRng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type ExamSelectionTraining = {
  examOnly: boolean
  randomizeQuestions?: boolean | null
  randomQuestionCount?: number | null
}

/**
 * Hem soru ekranı (GET /questions) hem skor hesabı (POST /submit) için kullanılan
 * deterministic soru kümesi. `attempt.id + phase` seed'i sayesinde aynı attempt'in
 * her isteği aynı subset ve sırayı görür. Bu fonksiyon iki taraf da çağırmalı —
 * aksi halde randomQuestionCount + examOnly kombinasyonunda puanlama bozulur.
 */
export function getEffectiveExamQuestions<Q extends { id: string }>(
  questions: Q[],
  training: ExamSelectionTraining,
  attemptId: string,
  phase: 'pre' | 'post',
): Q[] {
  const total = questions.length
  const subsetActive =
    !!training.examOnly &&
    !!training.randomQuestionCount &&
    training.randomQuestionCount > 0 &&
    training.randomQuestionCount < total
  const needsShuffle = !!training.randomizeQuestions || subsetActive
  let result = needsShuffle
    ? shuffle(questions, stringToSeed(`${attemptId}:${phase}:q`))
    : questions
  if (subsetActive) {
    result = result.slice(0, training.randomQuestionCount as number)
  }
  return result
}

/* ──────────────────────────────────────────────────────────────────────
   "Videosuz eğitim" akış kilidi —
   Attempt watching_videos'a girdiğinde, eğitimde post_exam'i tetikleyecek
   içerik (video/audio) yoksa attempt sonsuza dek bu statede takılı kalır.
   Bu helper, çağrıldığında "zorunlu içerik var mı?" kontrolünü yapar ve
   yoksa attempt'i otomatik post_exam'e taşır. Statussal guard ile çağrılır;
   yarış koşulunda yalnızca watching_videos olan attempt güncellenir.
   ────────────────────────────────────────────────────────────────────── */

export async function advancePastVideosIfNoneRequired(
  attemptId: string,
  trainingId: string,
): Promise<{ advanced: boolean; status: AttemptStatus }> {
  const [requiredCount, totalCount] = await Promise.all([
    prisma.trainingVideo.count({
      where: { trainingId, contentType: { not: 'pdf' } },
    }),
    prisma.trainingVideo.count({ where: { trainingId } }),
  ])
  if (requiredCount > 0) return { advanced: false, status: 'watching_videos' }
  // Teşhis sinyali (şikayet d — "video aşaması atlanıyor"): eğitimde içerik VAR
  // ama zorunlu video/ses YOK. PDF-only eğitimde bu normaldir; ama video'su
  // transcode'da silinmiş/bozulmuş bir eğitimde de aynı yoldan sessizce
  // atlanır. Log olmadan iki durum ayırt edilemiyordu.
  if (totalCount > 0) {
    logger.warn('ExamFlow', 'Video aşaması otomatik atlandı: eğitimde içerik var ama zorunlu video/ses yok (PDF-only mu, bozuk/eksik transcode mu?)', {
      trainingId,
      attemptId,
      totalCount,
    })
  }
  const now = new Date()
  const updated = await prisma.examAttempt.updateMany({
    where: { id: attemptId, status: 'watching_videos' },
    data: {
      status: 'post_exam',
      videosCompletedAt: now,
      postExamStartedAt: now,
    },
  })
  return { advanced: updated.count > 0, status: updated.count > 0 ? 'post_exam' : 'watching_videos' }
}
