/**
 * Exam Attempt + Training Assignment için **state machine**.
 *
 * Kapsam (TEK doğruluk kaynağı olduğu yer):
 *   - Status TRANSITION'ları (hangi event hangi state'e götürür)
 *   - Phase GUARD'ları (kullanıcı bu route'ta bulunabilir mi)
 *   - Submit sonrası ROUTING (hangi sayfaya yönlensin)
 *
 * Kapsam DIŞI (route/handler'da kalır):
 *   - DB `where` filter'lardaki status literal'ları (atomic guard amacı, transition değil)
 *   - Status'ten DB kolon seçimi (örn. pre_exam → preExamStartedAt) — projeksiyon, transition değil
 *   - Business policy (effectiveMaxAttempts, isPassed eşiği vb.)
 *
 * Strangler fig migration TAMAMLANDI: PR #38–42 ile exam/start, exam/submit,
 * videos/progress, cron/cleanup, admin reset, frontend phase guard'lar bu modüle
 * geçirildi. Yeni route eklerken transition logic'i burada tut.
 *
 * ──────────────────────────────────────────────────────────────────────
 * EXAM ATTEMPT (her sınav denemesi):
 *
 *   ┌─ START(examOnly=true) ──────────────────────────────► [post_exam]
 *   │
 *   │  START(examOnly=false, isRetry=false)
 *   │      ────────────────────────────────► [pre_exam]
 *   │                                            │
 *   │  START(examOnly=false, isRetry=true,       │ PRE_EXAM_SUBMITTED
 *   │        requirePreExamOnRetry=false)        ▼
 *   │      ─────────────────────────► [watching_videos]
 *   │                                            │
 *   │  START(examOnly=false, isRetry=true,       │ VIDEOS_COMPLETED
 *   │        requirePreExamOnRetry=true)         ▼
 *   │      ──────────────────────────► [pre_exam] [post_exam]
 *   │                                            │
 *   ▼                                            │ POST_EXAM_SUBMITTED
 *  (yeni denem yok)                              ▼
 *                                          [completed]
 *
 *   Her non-terminal state'ten EXPIRED'a transition mümkün
 *   (admin training delete VEYA cron cleanup 24h+).
 *
 * ──────────────────────────────────────────────────────────────────────
 * TRAINING ASSIGNMENT (atama bazlı):
 *
 *   [assigned] ─ ATTEMPT_STARTED ─► [in_progress]
 *                                       │
 *                                       ├─ POST_EXAM_PASSED ─► [passed]   (terminal)
 *                                       ├─ POST_EXAM_FAILED   ─► [failed] (attemptsRemaining=0)
 *                                       └─ POST_EXAM_FAILED   ─► [in_progress] (kalan deneme var)
 *
 *   [assigned, in_progress] ─ TRAINING_LOCKED ─► [locked]  (admin delete)
 *   [in_progress] ─ ATTEMPT_RESET ─► [assigned]  (admin "yeni hak ver" / stale cleanup)
 *
 * ──────────────────────────────────────────────────────────────────────
 */

// ── Status types ──────────────────────────────────────────────────────

export type AttemptStatus =
  | 'pre_exam'
  | 'watching_videos'
  | 'post_exam'
  | 'completed'
  | 'expired'

export type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'locked'

export const ATTEMPT_TERMINAL_STATUSES: readonly AttemptStatus[] = ['completed', 'expired'] as const
export const ASSIGNMENT_TERMINAL_STATUSES: readonly AssignmentStatus[] = ['passed', 'failed', 'locked'] as const

// ── Events (transition triggers) ──────────────────────────────────────

export type AttemptEvent =
  | {
      type: 'START'
      examOnly: boolean
      isRetry: boolean
      /** Eğitimde requirePreExamOnRetry=true ise retry'da yine pre-exam yap. */
      requirePreExamOnRetry: boolean
    }
  | { type: 'PRE_EXAM_SUBMITTED' }
  | { type: 'VIDEOS_COMPLETED' }
  | { type: 'POST_EXAM_SUBMITTED' }
  | { type: 'EXPIRE' }

export type AssignmentEvent =
  | { type: 'ATTEMPT_STARTED' }
  | { type: 'POST_EXAM_PASSED' }
  | { type: 'POST_EXAM_FAILED'; attemptsRemaining: number }
  | { type: 'TRAINING_LOCKED' }
  | { type: 'ATTEMPT_RESET' }

// ── Transition results ────────────────────────────────────────────────

export type TransitionResult<S> =
  | { ok: true; next: S }
  | { ok: false; reason: string }

// ── Attempt state machine ─────────────────────────────────────────────

/**
 * `current === null` → henüz hiç attempt yok (sadece START kabul edilir).
 * `current === '...'` → mevcut attempt'in status'ü.
 *
 * Geri dönüş ya `{ ok: true, next }` ya da `{ ok: false, reason }`.
 * "Geçersiz transition" durumlarını da explicit olarak `ok: false` ile döner.
 */
export function attemptNextStatus(
  current: AttemptStatus | null,
  event: AttemptEvent,
): TransitionResult<AttemptStatus> {
  // EXPIRE her non-terminal state'ten kabul edilir.
  if (event.type === 'EXPIRE') {
    if (current === null) return { ok: false, reason: 'Var olmayan attempt expire edilemez' }
    if (ATTEMPT_TERMINAL_STATUSES.includes(current)) {
      return { ok: false, reason: `Terminal state'ten (${current}) expire'a geçilemez` }
    }
    return { ok: true, next: 'expired' }
  }

  if (event.type === 'START') {
    if (current !== null) {
      return { ok: false, reason: `Zaten aktif attempt var (${current}); START kabul edilmez` }
    }
    if (event.examOnly) return { ok: true, next: 'post_exam' }
    if (event.isRetry && !event.requirePreExamOnRetry) return { ok: true, next: 'watching_videos' }
    return { ok: true, next: 'pre_exam' }
  }

  if (event.type === 'PRE_EXAM_SUBMITTED') {
    if (current !== 'pre_exam') {
      return { ok: false, reason: `pre_exam değil (${current}), pre-exam submit kabul edilmez` }
    }
    return { ok: true, next: 'watching_videos' }
  }

  if (event.type === 'VIDEOS_COMPLETED') {
    if (current !== 'watching_videos') {
      return { ok: false, reason: `watching_videos değil (${current}), video completion kabul edilmez` }
    }
    return { ok: true, next: 'post_exam' }
  }

  if (event.type === 'POST_EXAM_SUBMITTED') {
    if (current !== 'post_exam') {
      return { ok: false, reason: `post_exam değil (${current}), post-exam submit kabul edilmez` }
    }
    return { ok: true, next: 'completed' }
  }

  // Exhaustive check — yeni event tipi eklenirse compile error verir
  const _exhaustive: never = event
  return { ok: false, reason: `Bilinmeyen event: ${JSON.stringify(_exhaustive)}` }
}

// ── Assignment state machine ──────────────────────────────────────────

export function assignmentNextStatus(
  current: AssignmentStatus,
  event: AssignmentEvent,
): TransitionResult<AssignmentStatus> {
  if (event.type === 'TRAINING_LOCKED') {
    if (ASSIGNMENT_TERMINAL_STATUSES.includes(current)) {
      return { ok: false, reason: `Terminal state'ten (${current}) lock'a geçilemez` }
    }
    return { ok: true, next: 'locked' }
  }

  if (event.type === 'ATTEMPT_STARTED') {
    if (current === 'passed') {
      return { ok: false, reason: 'Passed assignment için yeni attempt başlatılamaz' }
    }
    if (current === 'locked') {
      return { ok: false, reason: 'Locked assignment için yeni attempt başlatılamaz' }
    }
    // assigned → in_progress; in_progress → in_progress (resume); failed → in_progress (admin yeni hak)
    return { ok: true, next: 'in_progress' }
  }

  if (event.type === 'POST_EXAM_PASSED') {
    if (current !== 'in_progress') {
      return { ok: false, reason: `in_progress değil (${current}), post-exam pass kabul edilmez` }
    }
    return { ok: true, next: 'passed' }
  }

  if (event.type === 'POST_EXAM_FAILED') {
    if (current !== 'in_progress') {
      return { ok: false, reason: `in_progress değil (${current}), post-exam fail kabul edilmez` }
    }
    return event.attemptsRemaining > 0
      ? { ok: true, next: 'in_progress' }
      : { ok: true, next: 'failed' }
  }

  if (event.type === 'ATTEMPT_RESET') {
    if (current === 'passed' || current === 'locked') {
      return { ok: false, reason: `Terminal state'ten (${current}) reset edilemez` }
    }
    return { ok: true, next: 'assigned' }
  }

  const _exhaustive: never = event
  return { ok: false, reason: `Bilinmeyen event: ${JSON.stringify(_exhaustive)}` }
}

// ── Phase guards (route'larda kullanılır) ─────────────────────────────

/**
 * Bir attempt'in beklenen phase'lerde olup olmadığını kontrol eder.
 * `getAttemptWithPhaseCheck`'in pure halı — route'larda string array karşılaştırması
 * yerine bu kullanılmalı.
 */
export function isAttemptInPhase(
  status: AttemptStatus,
  allowed: readonly AttemptStatus[],
): boolean {
  return allowed.includes(status)
}

/**
 * Yanlış phase'de olan kullanıcıyı nereye redirect etmeli? (Frontend phase guard)
 * `null` döndürürse "burada kalabilir" demektir.
 */
export type ExamRoute = 'pre-exam' | 'videos' | 'post-exam' | 'transition' | 'my-trainings'

export function attemptPhaseRedirect(status: AttemptStatus, currentRoute: ExamRoute): ExamRoute | null {
  // Terminal: her halükarda my-trainings'e dön
  if (status === 'completed' || status === 'expired') {
    return currentRoute === 'my-trainings' ? null : 'my-trainings'
  }
  // Aktif phase'in route'u zaten doğru mu?
  const expectedRoute: ExamRoute = ({
    pre_exam: 'pre-exam',
    watching_videos: 'videos',
    post_exam: 'post-exam',
  } as const)[status]
  return currentRoute === expectedRoute ? null : expectedRoute
}

/**
 * Attempt status → exam phase ('pre' | 'post' | null).
 * Sınav cevap/skor/timer kayıtları phase ekseniyle saklanır
 * (preExamScore, postExamCompletedAt, examPhase kolonu vb.). Bu helper status'ten
 * o eksene projeksiyon yapar — transition değil.
 *
 * `null` döner: status sınav fazında değil (watching_videos / completed / expired).
 */
export type ExamPhase = 'pre' | 'post'

export function attemptStatusToExamPhase(status: AttemptStatus): ExamPhase | null {
  if (status === 'pre_exam') return 'pre'
  if (status === 'post_exam') return 'post'
  return null
}

// ── Re-routing helper (transition page için) ──────────────────────────

/**
 * Submit sonrası nereye yönlendirilmeli? (transition page'in `from` query param mantığı)
 * Bu fonksiyon, status değil EVENT'e bakar — submit başarılı olduktan sonra çağrılır.
 */
export function postEventRoute(event: AttemptEvent): ExamRoute {
  switch (event.type) {
    case 'START':
      if (event.examOnly) return 'post-exam'
      if (event.isRetry && !event.requirePreExamOnRetry) return 'videos'
      return 'pre-exam'
    case 'PRE_EXAM_SUBMITTED':
      return 'transition' // → videos
    case 'VIDEOS_COMPLETED':
      return 'transition' // → post-exam
    case 'POST_EXAM_SUBMITTED':
      return 'transition' // → my-trainings (sonuç + feedback)
    case 'EXPIRE':
      return 'my-trainings'
    default: {
      const _exhaustive: never = event
      void _exhaustive
      return 'my-trainings'
    }
  }
}
