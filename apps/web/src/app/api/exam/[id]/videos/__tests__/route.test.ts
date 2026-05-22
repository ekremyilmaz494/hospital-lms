import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Bu test dosyası video ilerleme (lastPositionSeconds / watchedSeconds)
 * regresyon korumasını ve video izleme/sınav akışı güvenlik düzeltmelerini
 * kilitler:
 *
 *   1. POST /api/exam/[id]/videos — gelen body.position / body.watchedTime DB'de
 *      MEVCUT değerin altına ASLA inmemeli (stale sendBeacon koruması).
 *
 *   2. K1 — sunucu tarafı duvar-saati tavanı: bir video için İLK POST'ta tam
 *      süre iddiası, attempt watching_videos'a gireli geçen gerçek süreye
 *      clamp'lenmeli; video tek istekte "tamamlandı" olamaz.
 *
 *   3. Tamamlanma yalnız doğal bitişle: heartbeat değil, frontend onEnded →
 *      POST { completed:true } + anti-cheat izleme alt sınırı (%90).
 *
 *   4. Y3 — body.videoId bu attempt'in eğitimine ait değilse 404.
 *
 * Not: route artık read-compute-write'ı prisma.$transaction içine alır
 * (Y4 race koruması). Mock $transaction callback'i prismaMock'u tx olarak
 * geçirerek çalıştırır.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttempt: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    trainingVideo: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    videoProgress: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/exam-helpers', () => ({
  getAttemptStatus: vi.fn(),
  getActiveOrLatestAttemptStatus: vi.fn(),
}))
vi.mock('@/lib/training-video-url', () => ({
  resolveTrainingVideoUrl: vi.fn().mockResolvedValue(''),
  resolveTrainingDocumentUrl: vi.fn().mockResolvedValue(''),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withStaffRoute: <P>(handler: (ctx: {
    request: Request
    params: P
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        request,
        params: await params,
        dbUser: { id: 'staff-1', role: 'staff', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { POST } from '../route'
import { checkRateLimit } from '@/lib/redis'

function progressRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/exam/assignment-1/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VIDEO_ID = 'video-1'
const ATTEMPT_ID = 'attempt-1'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue(true)

  // preExamCompletedAt 1 saat önce → maxWatchable ~ 3600*1.5+30 = 5430s.
  // Çoğu testte K1 tavanı meşru değerleri etkilemez; K1'e özel testler
  // bu değeri yakın bir zamana çekerek tavanı düşürür.
  prismaMock.examAttempt.findFirst.mockResolvedValue({
    id: ATTEMPT_ID,
    userId: 'staff-1',
    trainingId: 'training-1',
    status: 'watching_videos',
    assignmentId: 'assignment-1',
    preExamCompletedAt: new Date(Date.now() - 60 * 60 * 1000),
  })

  prismaMock.trainingVideo.findFirst.mockResolvedValue({
    id: VIDEO_ID,
    trainingId: 'training-1',
    durationSeconds: 300,
    contentType: 'video',
    pageCount: null,
  })

  prismaMock.trainingVideo.findMany.mockResolvedValue([{ id: VIDEO_ID }])
  prismaMock.videoProgress.count.mockResolvedValue(0)
  prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.videoProgress.upsert.mockImplementation((args: { update: Record<string, unknown> }) =>
    Promise.resolve({ id: 'progress-1', ...args.update }),
  )
  prismaMock.$queryRaw.mockResolvedValue([])
  // $transaction: callback'i prismaMock'u tx olarak vererek çalıştır.
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock))
})

/** upsert çağrısının create/update payload'ında yazılacak watchedSeconds'ı çöz. */
function writtenWatched(): number {
  const args = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
    create: Record<string, unknown>
    update: Record<string, unknown>
  }
  // create yolunda düz sayı, update yolunda { set } operator.
  const created = args.create.watchedSeconds
  if (typeof created === 'number') return created
  const upd = args.update.watchedSeconds as { set: number }
  return upd.set
}

function writtenCreate(): Record<string, unknown> {
  return (prismaMock.videoProgress.upsert.mock.calls[0][0] as { create: Record<string, unknown> }).create
}

describe('POST /api/exam/[id]/videos — video progress regression guard', () => {
  describe('lastPositionSeconds geri-gitme koruması (KRİTİK)', () => {
    it('mevcut pozisyon (60) > yeni pozisyon (20) ise mevcut korunur — stale sendBeacon koruması', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 60,
        lastPositionSeconds: 60,
        updatedAt: new Date(Date.now() - 30_000),
      })

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 20, position: 20 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      expect(prismaMock.videoProgress.upsert).toHaveBeenCalledOnce()

      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        update: Record<string, unknown>
      }
      const watchedUpdate = upsertArgs.update.watchedSeconds as { set: number }
      expect(watchedUpdate.set).toBeGreaterThanOrEqual(60)
      expect(upsertArgs.update.lastPositionSeconds).toBeGreaterThanOrEqual(60)
    })

    it('mevcut pozisyon (60) < yeni pozisyon (90) ise yeni değer yazılır — normal heartbeat', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 60,
        lastPositionSeconds: 60,
        updatedAt: new Date(Date.now() - 5_000),
      })

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 70, position: 90 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        update: Record<string, unknown>
      }
      expect(upsertArgs.update.lastPositionSeconds).toBe(90)
    })

    it('ilk kayıt (existing yok) — gelen pozisyon doğrudan yazılır', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const create = writtenCreate()
      expect(create.lastPositionSeconds).toBe(30)
      expect(create.watchedSeconds).toBe(30)
    })

    it('pozisyon video süresinin üstüne çıkamaz (clamping)', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 500, position: 500 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const create = writtenCreate()
      // durationSeconds 300 → max 300
      expect(create.lastPositionSeconds).toBe(300)
      expect(create.watchedSeconds).toBe(300)
    })
  })

  describe('attempt status guard', () => {
    it('attempt watching_videos değilse 400 döner', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Aktif video izleme')
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })
  })

  describe('içerik silinme / yabancı video guard (E-2 + Y3)', () => {
    it('video silinmişse 404 döner — frontend bunu "içerik bulunamadı" olarak ayırt eder', async () => {
      // Admin videoyu sınav ortasında sildi → trainingVideo.findFirst null.
      prismaMock.trainingVideo.findFirst.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('bulunamadı')
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })

    it('Y3 — body.videoId başka eğitime aitse 404; cross-training progress yazımı engellenir', async () => {
      // findFirst trainingId guard'ı ile sorgulanır; yabancı video eşleşmez → null.
      prismaMock.trainingVideo.findFirst.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: 'foreign-video', watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(404)
      // findFirst, attempt.trainingId guard'ı içeren where ile çağrılmalı.
      const callArgs = prismaMock.trainingVideo.findFirst.mock.calls[0][0] as {
        where: Record<string, unknown>
      }
      expect(callArgs.where.id).toBe('foreign-video')
      expect(callArgs.where.trainingId).toBe('training-1')
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })
  })

  /**
   * K1 — sunucu tarafı duvar-saati tavanı.
   * Kök neden: existing-tabanlı hız denetimi yalnız `if (existing)` bloğunda
   * çalışıyordu; bir video için İLK POST'ta watchedTime=tam süre gönderilince
   * video tek istekte "tamamlandı" oluyordu. K1, requestedWatched'i attempt'in
   * watching_videos'a girişinden (preExamCompletedAt) bu yana geçen gerçek
   * süreye göre MUTLAK olarak sınırlar.
   */
  describe('K1 — duvar-saati tavanı (ilk POST tam-süre iddiası clamp)', () => {
    it('ilk POST: preExamCompletedAt 10sn önce + watchedTime=300 → ~45sn tavanına clamp, tamamlanmaz', async () => {
      // maxWatchable = 10*1.5 + 30 = 45 → requestedWatched max 45.
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: new Date(Date.now() - 10 * 1000),
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 300, position: 300 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      // completed bayrağı yok + K1 izleme 45sn'e clamp → tamamlanmaz.
      expect(body.allVideosCompleted).toBe(false)
      const watched = writtenWatched()
      expect(watched).toBeLessThanOrEqual(45)
      expect(writtenCreate().isCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })

    it('preExamCompletedAt yoksa tavan 30sn — ilk POST tam süre iddiası 30\'a clamp', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: null,
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 300, position: 300 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      expect(writtenWatched()).toBeLessThanOrEqual(30)
      expect(writtenCreate().isCompleted).toBe(false)
    })

    it('K1 tavanı mevcut ilerlemeyi GERİYE düşürmez — existing 200 > tavan ise existing korunur', async () => {
      // preExamCompletedAt 10sn önce → tavan 45. Ama existing 200 izlenmiş.
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: new Date(Date.now() - 10 * 1000),
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 200,
        lastPositionSeconds: 200,
        updatedAt: new Date(Date.now() - 5_000),
      })

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 210, position: 210 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      // Math.max(min(210,45), 200) = 200 — ilerleme geri düşmedi.
      expect(writtenWatched()).toBeGreaterThanOrEqual(200)
    })

    it('meşru gerçek-zamanlı izleyici tavanı tetiklemez — geçen süre içinde watchedTime', async () => {
      // preExamCompletedAt 200sn önce → tavan = 200*1.5+30 = 330. watchedTime 150 < 330.
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: new Date(Date.now() - 200 * 1000),
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 150, position: 150 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      // Meşru izleyici clamp'lenmez — 150 aynen yazılır.
      expect(writtenWatched()).toBe(150)
    })
  })

  /**
   * Tamamlanma — DOĞAL BİTİŞ (onended) zorunlu.
   * Ürün kararı: personel videonun TAMAMINI izlemeden son sınava geçemez.
   * Heartbeat POST'ları (completed bayrağı yok) hiçbir izleme oranında
   * tamamlama tetikleyemez; tamamlanma yalnız frontend onEnded →
   * POST { completed: true } ile + anti-cheat izleme alt sınırıyla verilir.
   */
  describe('tamamlanma — doğal bitiş (onended) zorunlu', () => {
    it('heartbeat (completed yok), %97 izlense bile → tamamlanmaz; yalnız onended tamamlar', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        // 290/300 = %97 — eski %95 eşiğini geçerdi; completed bayrağı yok → tamamlanmaz.
        progressRequest({ videoId: VIDEO_ID, watchedTime: 290, position: 290 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      expect(writtenCreate().isCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })

    it('onended (completed:true) + tam izleme → tamamlanır', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)
      prismaMock.videoProgress.count.mockResolvedValue(1)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 300, position: 300, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
      expect(writtenCreate().isCompleted).toBe(true)
    })

    it('onended (completed:true) + izleme anti-cheat alt sınırının üstünde (%95) → tamamlanır', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)
      prismaMock.videoProgress.count.mockResolvedValue(1)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 285, position: 285, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
      expect(writtenCreate().isCompleted).toBe(true)
    })

    it('onended (completed:true) ama izleme alt sınırın (%90) altında → tamamlanmaz (sahte-tamamlama engeli)', async () => {
      // body.completed:true taklit eden doğrudan POST: 100/300 = %33 izleme.
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 100, position: 100, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      expect(writtenCreate().isCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })
  })

  /**
   * Plan Faz 1, Adım 2 — durationSeconds güvenilmez olduğunda tamamlanma kapısı.
   * 0-süre güvenli yolu ve normal yolun bozulmadığını kilitler.
   */
  describe('durationSeconds güvenilmez — tamamlanma kapısı (Plan Faz 1, Adım 2)', () => {
    it('durationSeconds=0 + heartbeat (completed yok) → tamamlanmaz, ilerleme 0\'a clamp edilmez', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: new Date(Date.now() - 60 * 60 * 1000),
      })
      prismaMock.trainingVideo.findFirst.mockResolvedValue({
        id: VIDEO_ID, trainingId: 'training-1', durationSeconds: 0, contentType: 'video', pageCount: null,
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 120, position: 120 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      // Süre 0 olsa bile watched 0'a clamp EDİLMEZ — gerçek ilerleme korunur.
      // K1 tavanı (preExam 1 saat önce → ~5430) 120'yi etkilemez.
      expect(writtenCreate().watchedSeconds).toBe(120)
      expect(writtenCreate().isCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })

    it('durationSeconds=0 + completed:true (doğal bitiş) → tamamlanır', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: 'training-1',
        status: 'watching_videos',
        assignmentId: 'assignment-1',
        preExamCompletedAt: new Date(Date.now() - 60 * 60 * 1000),
      })
      prismaMock.trainingVideo.findFirst.mockResolvedValue({
        id: VIDEO_ID, trainingId: 'training-1', durationSeconds: 0, contentType: 'video', pageCount: null,
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)
      prismaMock.videoProgress.count.mockResolvedValue(1)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 120, position: 120, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
      expect(writtenCreate().isCompleted).toBe(true)
    })

    it('durationSeconds=300 + completed:true ama izleme anti-cheat alt sınırı (%90) altı → tamamlanmaz', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      // onended (completed:true) gelse de izlenen süre alt sınırın (300*0.9=270) altında → tamamlanmaz.
      expect(writtenCreate().isCompleted).toBe(false)
    })
  })

  /**
   * O6 — write endpoint rate limit. Kardeş videos/progress/route.ts deseni.
   */
  describe('O6 — rate limit', () => {
    it('checkRateLimit false dönerse 429 + yazma yapılmaz', async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(false)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(429)
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })

    it('review modunda rate limit kontrolünden önce 204 döner', async () => {
      const req = new Request('http://localhost/api/exam/assignment-1/videos?mode=review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: VIDEO_ID, mode: 'review' }),
      })
      const res = await POST(req, { params: Promise.resolve({ id: 'assignment-1' }) })
      expect(res.status).toBe(204)
      expect(checkRateLimit).not.toHaveBeenCalled()
    })
  })

  /**
   * Y4 — read-compute-write race koruması. Route artık $transaction +
   * pg_advisory_xact_lock kullanır.
   */
  describe('Y4 — atomik progress yazımı', () => {
    it('progress yazımı $transaction içinde yapılır ve advisory lock alınır', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      expect(prismaMock.$transaction).toHaveBeenCalledOnce()
      // advisory lock SELECT'i transaction içinde çalışmalı.
      expect(prismaMock.$queryRaw).toHaveBeenCalled()
    })
  })
})
