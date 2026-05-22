import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Bu test dosyası video ilerleme (lastPositionSeconds / watchedSeconds)
 * regresyon korumasını kilitler:
 *
 *   1. POST /api/exam/[id]/videos — gelen body.position / body.watchedTime DB'de
 *      MEVCUT değerin altına ASLA inmemeli. Aksi halde stale sendBeacon
 *      (pagehide veya network gecikmesi sonrası) kullanıcının ilerlemesini
 *      geri sarıp "tekrar giriş yaptığımda video baştan başladı" şikayetine
 *      yol açar.
 *
 *   2. watchedSeconds zaten Math.max ile korunuyordu; lastPositionSeconds
 *      koruma 2026-05-18 müşteri şikayetiyle eklendi. Bu test fix'in geri
 *      gelmemesini garanti eder — bkz: src/app/api/exam/[id]/videos/route.ts
 *      "Stale beacon koruması" yorumu.
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
      findMany: vi.fn(),
    },
    videoProgress: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
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

  prismaMock.examAttempt.findFirst.mockResolvedValue({
    id: ATTEMPT_ID,
    userId: 'staff-1',
    trainingId: 'training-1',
    status: 'watching_videos',
    assignmentId: 'assignment-1',
  })

  prismaMock.trainingVideo.findUnique.mockResolvedValue({
    id: VIDEO_ID,
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
})

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
      // Hem watchedSeconds hem lastPositionSeconds geri sarmamalı.
      // "set" anti-cheat için Prisma operator object; raw değer yerine onu kontrol et.
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
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>
      }
      expect(upsertArgs.create.lastPositionSeconds).toBe(30)
      expect(upsertArgs.create.watchedSeconds).toBe(30)
    })

    it('pozisyon video süresinin üstüne çıkamaz (clamping)', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 500, position: 500 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>
      }
      // durationSeconds 300 → max 300
      expect(upsertArgs.create.lastPositionSeconds).toBe(300)
      expect(upsertArgs.create.watchedSeconds).toBe(300)
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

  describe('içerik silinme guard (E-2)', () => {
    it('video silinmişse 404 döner — frontend bunu "içerik bulunamadı" olarak ayırt eder', async () => {
      // Admin videoyu sınav ortasında sildi → trainingVideo.findUnique null.
      prismaMock.trainingVideo.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toContain('bulunamadı')
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })
  })

  /**
   * Plan Faz 1, Adım 2 — durationSeconds güvenilmez olduğunda tamamlanma kapısı.
   * Kök neden: video süresi yüklemede ölçülmüyordu; durationSeconds=0 iken
   * `0 >= 0*0.80` her POST'ta true olup videoyu anında "tamamlandı" sayıyor,
   * personeli video ortasında akıştan atıyordu. Bu testler hem 0-süre güvenli
   * yolunu hem de normal (%80) yolun bozulmadığını kilitler.
   */
  describe('durationSeconds güvenilmez — tamamlanma kapısı (Plan Faz 1, Adım 2)', () => {
    it('durationSeconds=0 + heartbeat (completed yok) → tamamlanmaz, ilerleme 0\'a clamp edilmez', async () => {
      prismaMock.trainingVideo.findUnique.mockResolvedValue({
        id: VIDEO_ID, durationSeconds: 0, contentType: 'video', pageCount: null,
      })
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 120, position: 120 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>
      }
      // Süre 0 olsa bile watched 0'a clamp EDİLMEZ — gerçek ilerleme korunur.
      expect(upsertArgs.create.watchedSeconds).toBe(120)
      expect(upsertArgs.create.isCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })

    it('durationSeconds=0 + completed:true (doğal bitiş) → tamamlanır', async () => {
      prismaMock.trainingVideo.findUnique.mockResolvedValue({
        id: VIDEO_ID, durationSeconds: 0, contentType: 'video', pageCount: null,
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
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>
      }
      expect(upsertArgs.create.isCompleted).toBe(true)
    })

    it('durationSeconds=300 (güvenilir) + %80 izleme → tamamlanır (regresyon: normal yol)', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)
      prismaMock.videoProgress.count.mockResolvedValue(1)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 240, position: 240 }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
    })

    it('durationSeconds=300 + completed:true ama izleme %80 altı → tamamlanmaz (anti-cheat korunur)', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue(null)

      const res = await POST(
        progressRequest({ videoId: VIDEO_ID, watchedTime: 30, position: 30, completed: true }),
        { params: Promise.resolve({ id: 'assignment-1' }) },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, unknown>
      }
      // Güvenilir sürede body.completed yok sayılır — server-side %80 hesabı uygulanır.
      expect(upsertArgs.create.isCompleted).toBe(false)
    })
  })
})
