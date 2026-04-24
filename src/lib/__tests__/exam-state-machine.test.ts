import { describe, it, expect } from 'vitest'
import {
  attemptNextStatus,
  assignmentNextStatus,
  isAttemptInPhase,
  attemptPhaseRedirect,
  postEventRoute,
  ATTEMPT_TERMINAL_STATUSES,
  ASSIGNMENT_TERMINAL_STATUSES,
  type AttemptStatus,
  type AssignmentStatus,
} from '../exam-state-machine'

// ════════════════════════════════════════════════════════════════════
// ATTEMPT — START event
// ════════════════════════════════════════════════════════════════════

describe('attemptNextStatus — START', () => {
  it('null + examOnly=true → post_exam', () => {
    const r = attemptNextStatus(null, {
      type: 'START', examOnly: true, isRetry: false, requirePreExamOnRetry: false,
    })
    expect(r).toEqual({ ok: true, next: 'post_exam' })
  })

  it('null + normal (examOnly=false, isRetry=false) → pre_exam', () => {
    const r = attemptNextStatus(null, {
      type: 'START', examOnly: false, isRetry: false, requirePreExamOnRetry: false,
    })
    expect(r).toEqual({ ok: true, next: 'pre_exam' })
  })

  it('null + retry + requirePreExamOnRetry=false → watching_videos', () => {
    const r = attemptNextStatus(null, {
      type: 'START', examOnly: false, isRetry: true, requirePreExamOnRetry: false,
    })
    expect(r).toEqual({ ok: true, next: 'watching_videos' })
  })

  it('null + retry + requirePreExamOnRetry=true → pre_exam (admin retry için pre-exam istiyor)', () => {
    const r = attemptNextStatus(null, {
      type: 'START', examOnly: false, isRetry: true, requirePreExamOnRetry: true,
    })
    expect(r).toEqual({ ok: true, next: 'pre_exam' })
  })

  it('mevcut attempt varken START → reddedilir', () => {
    const r = attemptNextStatus('pre_exam', {
      type: 'START', examOnly: false, isRetry: false, requirePreExamOnRetry: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/aktif attempt/)
  })
})

// ════════════════════════════════════════════════════════════════════
// ATTEMPT — Phase transitions
// ════════════════════════════════════════════════════════════════════

describe('attemptNextStatus — PRE_EXAM_SUBMITTED', () => {
  it('pre_exam → watching_videos', () => {
    expect(attemptNextStatus('pre_exam', { type: 'PRE_EXAM_SUBMITTED' })).toEqual({
      ok: true, next: 'watching_videos',
    })
  })

  it('watching_videos\'tan PRE_EXAM_SUBMITTED reddedilir', () => {
    const r = attemptNextStatus('watching_videos', { type: 'PRE_EXAM_SUBMITTED' })
    expect(r.ok).toBe(false)
  })

  it('post_exam\'dan reddedilir', () => {
    expect(attemptNextStatus('post_exam', { type: 'PRE_EXAM_SUBMITTED' }).ok).toBe(false)
  })

  it('completed\'tan reddedilir', () => {
    expect(attemptNextStatus('completed', { type: 'PRE_EXAM_SUBMITTED' }).ok).toBe(false)
  })
})

describe('attemptNextStatus — VIDEOS_COMPLETED', () => {
  it('watching_videos → post_exam', () => {
    expect(attemptNextStatus('watching_videos', { type: 'VIDEOS_COMPLETED' })).toEqual({
      ok: true, next: 'post_exam',
    })
  })

  it('pre_exam\'dan reddedilir', () => {
    expect(attemptNextStatus('pre_exam', { type: 'VIDEOS_COMPLETED' }).ok).toBe(false)
  })

  it('post_exam\'dan reddedilir (zaten geçilmiş)', () => {
    expect(attemptNextStatus('post_exam', { type: 'VIDEOS_COMPLETED' }).ok).toBe(false)
  })
})

describe('attemptNextStatus — POST_EXAM_SUBMITTED', () => {
  it('post_exam → completed', () => {
    expect(attemptNextStatus('post_exam', { type: 'POST_EXAM_SUBMITTED' })).toEqual({
      ok: true, next: 'completed',
    })
  })

  it('pre_exam\'dan reddedilir', () => {
    expect(attemptNextStatus('pre_exam', { type: 'POST_EXAM_SUBMITTED' }).ok).toBe(false)
  })

  it('watching_videos\'tan reddedilir (videoları bitirmeden post submit)', () => {
    expect(attemptNextStatus('watching_videos', { type: 'POST_EXAM_SUBMITTED' }).ok).toBe(false)
  })

  it('completed\'tan reddedilir (idempotency)', () => {
    expect(attemptNextStatus('completed', { type: 'POST_EXAM_SUBMITTED' }).ok).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════
// ATTEMPT — EXPIRE
// ════════════════════════════════════════════════════════════════════

describe('attemptNextStatus — EXPIRE', () => {
  it.each(['pre_exam', 'watching_videos', 'post_exam'] as const)(
    '%s → expired',
    (status) => {
      expect(attemptNextStatus(status, { type: 'EXPIRE' })).toEqual({
        ok: true, next: 'expired',
      })
    },
  )

  it('completed → expire reddedilir (terminal)', () => {
    expect(attemptNextStatus('completed', { type: 'EXPIRE' }).ok).toBe(false)
  })

  it('expired → expire reddedilir (idempotent değil — explicit hata)', () => {
    expect(attemptNextStatus('expired', { type: 'EXPIRE' }).ok).toBe(false)
  })

  it('null → expire reddedilir (var olmayan attempt)', () => {
    expect(attemptNextStatus(null, { type: 'EXPIRE' }).ok).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════
// ASSIGNMENT
// ════════════════════════════════════════════════════════════════════

describe('assignmentNextStatus — ATTEMPT_STARTED', () => {
  it('assigned → in_progress', () => {
    expect(assignmentNextStatus('assigned', { type: 'ATTEMPT_STARTED' })).toEqual({
      ok: true, next: 'in_progress',
    })
  })

  it('in_progress → in_progress (resume)', () => {
    expect(assignmentNextStatus('in_progress', { type: 'ATTEMPT_STARTED' })).toEqual({
      ok: true, next: 'in_progress',
    })
  })

  it('failed → in_progress (admin yeni hak verdiyse)', () => {
    expect(assignmentNextStatus('failed', { type: 'ATTEMPT_STARTED' })).toEqual({
      ok: true, next: 'in_progress',
    })
  })

  it('passed\'ten reddedilir', () => {
    expect(assignmentNextStatus('passed', { type: 'ATTEMPT_STARTED' }).ok).toBe(false)
  })

  it('locked\'tan reddedilir', () => {
    expect(assignmentNextStatus('locked', { type: 'ATTEMPT_STARTED' }).ok).toBe(false)
  })
})

describe('assignmentNextStatus — POST_EXAM_PASSED/FAILED', () => {
  it('in_progress + PASSED → passed', () => {
    expect(assignmentNextStatus('in_progress', { type: 'POST_EXAM_PASSED' })).toEqual({
      ok: true, next: 'passed',
    })
  })

  it('in_progress + FAILED + kalan deneme var → in_progress', () => {
    expect(
      assignmentNextStatus('in_progress', { type: 'POST_EXAM_FAILED', attemptsRemaining: 2 }),
    ).toEqual({ ok: true, next: 'in_progress' })
  })

  it('in_progress + FAILED + deneme kalmadı → failed', () => {
    expect(
      assignmentNextStatus('in_progress', { type: 'POST_EXAM_FAILED', attemptsRemaining: 0 }),
    ).toEqual({ ok: true, next: 'failed' })
  })

  it('assigned\'dan PASSED reddedilir (önce ATTEMPT_STARTED gerekli)', () => {
    expect(assignmentNextStatus('assigned', { type: 'POST_EXAM_PASSED' }).ok).toBe(false)
  })
})

describe('assignmentNextStatus — TRAINING_LOCKED', () => {
  it.each(['assigned', 'in_progress'] as const)('%s → locked', (s) => {
    expect(assignmentNextStatus(s, { type: 'TRAINING_LOCKED' })).toEqual({
      ok: true, next: 'locked',
    })
  })

  it.each(['passed', 'failed', 'locked'] as const)('terminal (%s) → lock reddedilir', (s) => {
    expect(assignmentNextStatus(s, { type: 'TRAINING_LOCKED' }).ok).toBe(false)
  })
})

describe('assignmentNextStatus — ATTEMPT_RESET', () => {
  it('in_progress → assigned (admin yeni hak)', () => {
    expect(assignmentNextStatus('in_progress', { type: 'ATTEMPT_RESET' })).toEqual({
      ok: true, next: 'assigned',
    })
  })

  it('failed → assigned (admin yeni hak)', () => {
    expect(assignmentNextStatus('failed', { type: 'ATTEMPT_RESET' })).toEqual({
      ok: true, next: 'assigned',
    })
  })

  it('passed → reset reddedilir (terminal başarı)', () => {
    expect(assignmentNextStatus('passed', { type: 'ATTEMPT_RESET' }).ok).toBe(false)
  })

  it('locked → reset reddedilir', () => {
    expect(assignmentNextStatus('locked', { type: 'ATTEMPT_RESET' }).ok).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════
// PHASE GUARDS (frontend)
// ════════════════════════════════════════════════════════════════════

describe('isAttemptInPhase', () => {
  it('izinli phase\'de → true', () => {
    expect(isAttemptInPhase('pre_exam', ['pre_exam', 'post_exam'])).toBe(true)
  })

  it('izinsiz phase\'de → false', () => {
    expect(isAttemptInPhase('watching_videos', ['pre_exam', 'post_exam'])).toBe(false)
  })

  it('boş allowed listesi → her zaman false', () => {
    expect(isAttemptInPhase('pre_exam', [])).toBe(false)
  })
})

describe('attemptPhaseRedirect', () => {
  it('completed → my-trainings (zaten oradaysa null)', () => {
    expect(attemptPhaseRedirect('completed', 'pre-exam')).toBe('my-trainings')
    expect(attemptPhaseRedirect('completed', 'my-trainings')).toBe(null)
  })

  it('expired → my-trainings', () => {
    expect(attemptPhaseRedirect('expired', 'videos')).toBe('my-trainings')
  })

  it('pre_exam route ile pre_exam status → null (kal)', () => {
    expect(attemptPhaseRedirect('pre_exam', 'pre-exam')).toBe(null)
  })

  it('pre_exam status + videos route → pre-exam\'a redirect', () => {
    expect(attemptPhaseRedirect('pre_exam', 'videos')).toBe('pre-exam')
  })

  it('watching_videos status + post-exam route → videos\'a redirect', () => {
    expect(attemptPhaseRedirect('watching_videos', 'post-exam')).toBe('videos')
  })

  it('post_exam status + my-trainings → post-exam\'a redirect (yarıda bırakılmış)', () => {
    expect(attemptPhaseRedirect('post_exam', 'my-trainings')).toBe('post-exam')
  })
})

// ════════════════════════════════════════════════════════════════════
// POST-EVENT ROUTING
// ════════════════════════════════════════════════════════════════════

describe('postEventRoute', () => {
  it('START examOnly → post-exam', () => {
    expect(postEventRoute({
      type: 'START', examOnly: true, isRetry: false, requirePreExamOnRetry: false,
    })).toBe('post-exam')
  })

  it('START retry + skip pre-exam → videos', () => {
    expect(postEventRoute({
      type: 'START', examOnly: false, isRetry: true, requirePreExamOnRetry: false,
    })).toBe('videos')
  })

  it('START normal → pre-exam', () => {
    expect(postEventRoute({
      type: 'START', examOnly: false, isRetry: false, requirePreExamOnRetry: false,
    })).toBe('pre-exam')
  })

  it.each([
    'PRE_EXAM_SUBMITTED', 'VIDEOS_COMPLETED', 'POST_EXAM_SUBMITTED',
  ] as const)('%s → transition (countdown sayfası)', (type) => {
    expect(postEventRoute({ type })).toBe('transition')
  })

  it('EXPIRE → my-trainings', () => {
    expect(postEventRoute({ type: 'EXPIRE' })).toBe('my-trainings')
  })
})

// ════════════════════════════════════════════════════════════════════
// SAFETY: terminal lists ile state listesi uyumlu mu
// ════════════════════════════════════════════════════════════════════

describe('Terminal sabitleri', () => {
  it('attempt terminal: completed + expired', () => {
    expect([...ATTEMPT_TERMINAL_STATUSES].sort()).toEqual(['completed', 'expired'])
  })

  it('assignment terminal: passed + failed + locked', () => {
    expect([...ASSIGNMENT_TERMINAL_STATUSES].sort()).toEqual(['failed', 'locked', 'passed'])
  })
})

// ════════════════════════════════════════════════════════════════════
// FULL FLOW SIMULATIONS
// ════════════════════════════════════════════════════════════════════

describe('Full flow simulations', () => {
  it('Normal eğitim akışı: null → pre_exam → watching_videos → post_exam → completed', () => {
    let s: AttemptStatus | null = null
    let r = attemptNextStatus(s, { type: 'START', examOnly: false, isRetry: false, requirePreExamOnRetry: false })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('pre_exam')

    r = attemptNextStatus(s, { type: 'PRE_EXAM_SUBMITTED' })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('watching_videos')

    r = attemptNextStatus(s, { type: 'VIDEOS_COMPLETED' })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('post_exam')

    r = attemptNextStatus(s, { type: 'POST_EXAM_SUBMITTED' })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('completed')
  })

  it('examOnly: null → post_exam → completed (pre + videos atlanır)', () => {
    let s: AttemptStatus | null = null
    let r = attemptNextStatus(s, { type: 'START', examOnly: true, isRetry: false, requirePreExamOnRetry: false })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('post_exam')

    r = attemptNextStatus(s, { type: 'POST_EXAM_SUBMITTED' })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('completed')
  })

  it('Retry default: null → watching_videos → post_exam → completed (pre-exam atlanır)', () => {
    let s: AttemptStatus | null = null
    let r = attemptNextStatus(s, { type: 'START', examOnly: false, isRetry: true, requirePreExamOnRetry: false })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('watching_videos')

    r = attemptNextStatus(s, { type: 'VIDEOS_COMPLETED' })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('post_exam')
  })

  it('Retry + requirePreExamOnRetry: null → pre_exam → ...', () => {
    let s: AttemptStatus | null = null
    const r = attemptNextStatus(s, { type: 'START', examOnly: false, isRetry: true, requirePreExamOnRetry: true })
    expect(r.ok).toBe(true); if (r.ok) s = r.next
    expect(s).toBe('pre_exam')
  })

  it('Assignment full: assigned → in_progress → passed', () => {
    let a: AssignmentStatus = 'assigned'
    let r = assignmentNextStatus(a, { type: 'ATTEMPT_STARTED' })
    expect(r.ok).toBe(true); if (r.ok) a = r.next
    expect(a).toBe('in_progress')

    r = assignmentNextStatus(a, { type: 'POST_EXAM_PASSED' })
    expect(r.ok).toBe(true); if (r.ok) a = r.next
    expect(a).toBe('passed')
  })

  it('Assignment max attempts: in_progress → fail → fail → fail (final → failed)', () => {
    let a: AssignmentStatus = 'in_progress'
    let r = assignmentNextStatus(a, { type: 'POST_EXAM_FAILED', attemptsRemaining: 2 })
    expect(r.ok).toBe(true); if (r.ok) a = r.next
    expect(a).toBe('in_progress')

    r = assignmentNextStatus(a, { type: 'POST_EXAM_FAILED', attemptsRemaining: 1 })
    expect(r.ok).toBe(true); if (r.ok) a = r.next
    expect(a).toBe('in_progress')

    r = assignmentNextStatus(a, { type: 'POST_EXAM_FAILED', attemptsRemaining: 0 })
    expect(r.ok).toBe(true); if (r.ok) a = r.next
    expect(a).toBe('failed')
  })
})
