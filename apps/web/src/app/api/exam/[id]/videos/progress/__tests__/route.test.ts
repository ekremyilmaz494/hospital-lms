import { describe, it, expect, vi, beforeEach } from 'vitest'
// Ortak personel (Faz 2.4): getStaffOrgIds tek-org döndürsün → myOrgs=[A], davranış eski tekil-org ile birebir.
vi.mock('@/lib/staff-orgs', () => ({ getStaffOrgIds: vi.fn(async (_userId, primaryOrgId) => [primaryOrgId]) }))

/**
 * Bu test dosyası ESKİ/paralel video ilerleme endpoint'i
 * (POST /api/exam/[id]/videos/progress) için K2 sertleştirmesini kilitler.
 *
 * Route bir mobil/Expo istemcisi için canlı tutulur ama ana endpoint
 * (/videos/route.ts) ile AYNI anti-cheat seviyesinde olmalıdır:
 *
 *   1. Duvar-saati tavanı — istemci watchedSeconds'ı doğrudan gönderdiği için
 *      preExamCompletedAt'tan bu yana geçen süre %150 + 30sn ile cap'lenir.
 *      Tavan olmadan ilk POST'ta tam süre gönderip videoyu tek seferde
 *      tamamlatmak mümkündü.
 *   2. İzleme hızı denetimi — mevcut kayıt varsa watchedSeconds delta'sı
 *      wall-clock delta'nın %150'sini + 5sn'i aşamaz.
 *   3. %95 eşiği — MIN_WATCH_PERCENT artık 0.80 değil 0.95.
 *   4. Sıfır süre koruması — durationSeconds<=0 iken `0 >= 0*0.95` = true
 *      olup videoyu ilk POST'ta tamamlardı; artık isCompleted=false kalır.
 *   5. PDF hariç sayım — allVideos sorgusu contentType: { not: 'pdf' } ile
 *      filtrelenir; PDF'ler son sınava geçiş sayımına girmez.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    examAttempt: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    trainingVideo: {
      findFirst: vi.fn(),
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

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
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
import { logger } from '@/lib/logger'

const VIDEO_ID = 'video-1'
const ATTEMPT_ID = 'attempt-1'
const TRAINING_ID = 'training-1'

function progressRequest(body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/exam/${ATTEMPT_ID}/videos/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function callPost(body: Record<string, unknown>) {
  return POST(progressRequest(body), { params: Promise.resolve({ id: ATTEMPT_ID }) })
}

beforeEach(() => {
  vi.clearAllMocks()

  // Varsayılan: preExam ~1 saat önce bitmiş → duvar-saati tavanı bol.
  prismaMock.examAttempt.findFirst.mockResolvedValue({
    id: ATTEMPT_ID,
    userId: 'staff-1',
    trainingId: TRAINING_ID,
    status: 'watching_videos',
    preExamCompletedAt: new Date(Date.now() - 60 * 60 * 1000),
    training: { organizationId: 'org-1' },
  })

  prismaMock.trainingVideo.findFirst.mockResolvedValue({
    id: VIDEO_ID,
    trainingId: TRAINING_ID,
    durationSeconds: 300,
    contentType: 'video',
    pageCount: null,
  })

  prismaMock.trainingVideo.findMany.mockResolvedValue([{ id: VIDEO_ID }])
  prismaMock.videoProgress.findUnique.mockResolvedValue(null)
  prismaMock.videoProgress.count.mockResolvedValue(0)
  prismaMock.examAttempt.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.videoProgress.upsert.mockImplementation((args: { create: Record<string, unknown> }) =>
    Promise.resolve({ id: 'progress-1', ...args.create }),
  )
})

describe('POST /api/exam/[id]/videos/progress — K2 sertleştirme regresyon guard', () => {
  describe('duvar-saati tavanı (K1 yansıması)', () => {
    it('preExam yeni bittiyse (5sn önce) ilk POST tam süreyi gönderse de tavan ile cap\'lenir', async () => {
      // preExam 5sn önce bitti → maxWatchable = 5*1.5 + 30 = 37.5 → floor 37
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: TRAINING_ID,
        status: 'watching_videos',
        preExamCompletedAt: new Date(Date.now() - 5_000),
        training: { organizationId: 'org-1' },
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 300, lastPositionSeconds: 300 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      // 300 istendi ama tavan ~37 → watchedSeconds tavana clamp edilir
      expect(upsertArgs.create.watchedSeconds).toBeLessThanOrEqual(37)
      // Tavan altında kaldığı için video tek POST'ta tamamlanamaz
      expect(upsertArgs.create.isCompleted).toBe(false)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
    })

    it('preExamCompletedAt null ise createdAt fallback — geçen süre tavanı uygulanır', async () => {
      // Eski davranış sabit 30sn tavanıydı: preExam damgası olmayan akışlarda
      // (retry/examOnly) baştan sona izlenmiş video "asla tamamlanamaz" oluyordu.
      // Yeni: attempt.createdAt'a düş (videos/route.ts ile aynı). Attempt 10sn
      // önce yaratıldı → maxWatchable = 10*1.5 + 30 = 45.
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: TRAINING_ID,
        status: 'watching_videos',
        preExamCompletedAt: null,
        createdAt: new Date(Date.now() - 10_000),
        training: { organizationId: 'org-1' },
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 300, lastPositionSeconds: 300 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.watchedSeconds).toBeLessThanOrEqual(45)
      expect(upsertArgs.create.isCompleted).toBe(false)
    })

    it('preExam uzun süre önce bittiyse tavan bol — gerçek izleme kısıtlanmaz', async () => {
      // preExam 1 saat önce → tavan >> video süresi → video süresi (300) kapısı geçerli
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 300, lastPositionSeconds: 300 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      // 300 izlendi, video süresi 300 → %95 üstü → tamamlanır
      expect(upsertArgs.create.watchedSeconds).toBe(300)
      expect(upsertArgs.create.isCompleted).toBe(true)
    })
  })

  describe('izleme hızı denetimi', () => {
    it('mevcut kayıttan duvar-saati delta\'sının çok üstünde artış clamp\'lenir + uyarı loglanır', async () => {
      // existing 5sn önce güncellendi, watched=10 → maxDelta = 5*1.5+5 = 12.5 → +12
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 10,
        lastPositionSeconds: 10,
        updatedAt: new Date(Date.now() - 5_000),
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 250, lastPositionSeconds: 250 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        update: Record<string, number | boolean>
      }
      // 10 + floor(12.5) = 22 — 250 değil
      expect(upsertArgs.update.watchedSeconds).toBe(22)
      expect(logger.warn).toHaveBeenCalledWith(
        'VideoProgress',
        'Suspicious watch rate',
        expect.objectContaining({ attemptId: ATTEMPT_ID, videoId: VIDEO_ID }),
      )
    })

    it('normal heartbeat (delta tavan altında) clamp edilmez, uyarı loglanmaz', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 100,
        lastPositionSeconds: 100,
        updatedAt: new Date(Date.now() - 10_000),
      })

      // 10sn'de 105'e (5sn artış) — maxDelta = 10*1.5+5 = 20, sorun yok
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 105, lastPositionSeconds: 105 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        update: Record<string, number | boolean>
      }
      expect(upsertArgs.update.watchedSeconds).toBe(105)
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('mevcut ilerleme geriye düşmez — düşük watchedSeconds gelse mevcut korunur', async () => {
      prismaMock.videoProgress.findUnique.mockResolvedValue({
        attemptId: ATTEMPT_ID,
        videoId: VIDEO_ID,
        watchedSeconds: 200,
        lastPositionSeconds: 200,
        updatedAt: new Date(Date.now() - 10_000),
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 50, lastPositionSeconds: 50 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        update: Record<string, number | boolean>
      }
      expect(upsertArgs.update.watchedSeconds).toBe(200)
      expect(upsertArgs.update.lastPositionSeconds).toBe(200)
    })
  })

  describe('%95 eşiği (MIN_WATCH_PERCENT)', () => {
    it('izleme %95 altıysa tamamlanmaz — eski %80 eşiği artık geçmez', async () => {
      // 300 * 0.95 = 285. 250 izleme eski %80 (240) eşiğini geçerdi ama %95'i geçmez.
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 250, lastPositionSeconds: 250 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(false)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
    })

    it('izleme %95 üstüyse tamamlanır', async () => {
      prismaMock.videoProgress.count.mockResolvedValue(1)

      // 300 * 0.95 = 285. 290 izleme → tamamlanır.
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(true)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
    })
  })

  describe('açık tamamlanma sinyali (completed flag — B2)', () => {
    it('completed gönderilmediyse (eski istemci) %95 eşiği tek başına tamamlar (geriye-uyumlu)', async () => {
      // 290 >= 285 (%95) ve completed YOK → mevcut davranış: tamamlanır
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(true)
    })

    it('completed:true + %95 üstü → tamamlanır (yeni istemci, onEnded)', async () => {
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290, completed: true })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(true)
    })

    it('completed:false + %95 üstü → tamamlanmaz (yeni istemci henüz bitmedi der)', async () => {
      // %95 eşiği geçilse bile yeni istemci açıkça "bitmedi" diyor → erken tamamlanma yok
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290, completed: false })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(false)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
    })

    it('completed:true ama %95 altı → tamamlanmaz (eşik hâlâ zorunlu)', async () => {
      // 250 < 285 (%95) → completed:true gelse de eşik geçilmeden tamamlanmaz
      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 250, lastPositionSeconds: 250, completed: true })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(false)
    })
  })

  describe('sıfır süre koruması', () => {
    it('durationSeconds=0 iken ilk POST videoyu tamamlamaz (sahte tamamlanma engellenir)', async () => {
      prismaMock.trainingVideo.findFirst.mockResolvedValue({
        id: VIDEO_ID,
        trainingId: TRAINING_ID,
        durationSeconds: 0,
        contentType: 'video',
        pageCount: null,
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 0, lastPositionSeconds: 0 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(false)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(false)
      expect(prismaMock.examAttempt.updateMany).not.toHaveBeenCalled()
    })

    it('durationSeconds<=0 iken yüksek watchedSeconds gelse de tamamlanmaz', async () => {
      prismaMock.trainingVideo.findFirst.mockResolvedValue({
        id: VIDEO_ID,
        trainingId: TRAINING_ID,
        durationSeconds: 0,
        contentType: 'video',
        pageCount: null,
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 9999, lastPositionSeconds: 9999 })

      expect(res.status).toBe(200)
      const upsertArgs = prismaMock.videoProgress.upsert.mock.calls[0][0] as {
        create: Record<string, number | boolean>
      }
      expect(upsertArgs.create.isCompleted).toBe(false)
    })
  })

  describe('PDF hariç sayım (allVideos)', () => {
    it('allVideos sorgusu contentType: { not: pdf } filtresiyle çağrılır', async () => {
      await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290 })

      expect(prismaMock.trainingVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            trainingId: TRAINING_ID,
            contentType: { not: 'pdf' },
          }),
        }),
      )
    })

    it('completedVideos sayımı yalnız non-PDF video kümesine scope\'lanır', async () => {
      prismaMock.trainingVideo.findMany.mockResolvedValue([{ id: VIDEO_ID }, { id: 'video-2' }])

      await callPost({ videoId: VIDEO_ID, watchedSeconds: 290, lastPositionSeconds: 290 })

      expect(prismaMock.videoProgress.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attemptId: ATTEMPT_ID,
            isCompleted: true,
            videoId: { in: [VIDEO_ID, 'video-2'] },
          }),
        }),
      )
    })

    it('tüm non-PDF videolar tamamlanınca state machine geçişi tetiklenir', async () => {
      prismaMock.trainingVideo.findMany.mockResolvedValue([{ id: VIDEO_ID }])
      prismaMock.videoProgress.count.mockResolvedValue(1)

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 300, lastPositionSeconds: 300 })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.allVideosCompleted).toBe(true)
      expect(prismaMock.examAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ATTEMPT_ID, status: 'watching_videos' },
        }),
      )
      // KRİTİK (İZEM CAN incident): video bitiminde postExamStartedAt SET EDİLMEZ.
      const transitionArgs = prismaMock.examAttempt.updateMany.mock.calls.at(-1)![0] as {
        data: Record<string, unknown>
      }
      expect(transitionArgs.data).toHaveProperty('videosCompletedAt')
      expect(transitionArgs.data).toHaveProperty('status')
      expect(transitionArgs.data).not.toHaveProperty('postExamStartedAt')
    })
  })

  describe('mevcut guard\'lar korunur', () => {
    it('attempt watching_videos değilse 400 döner', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue(null)

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 100, lastPositionSeconds: 100 })

      expect(res.status).toBe(400)
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })

    it('video bu eğitime ait değilse 404 döner', async () => {
      prismaMock.trainingVideo.findFirst.mockResolvedValue(null)

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 100, lastPositionSeconds: 100 })

      expect(res.status).toBe(404)
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })

    it('org izolasyonu — attempt başka org\'a aitse 403 döner', async () => {
      prismaMock.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT_ID,
        userId: 'staff-1',
        trainingId: TRAINING_ID,
        status: 'watching_videos',
        preExamCompletedAt: new Date(Date.now() - 60 * 60 * 1000),
        training: { organizationId: 'other-org' },
      })

      const res = await callPost({ videoId: VIDEO_ID, watchedSeconds: 100, lastPositionSeconds: 100 })

      expect(res.status).toBe(403)
      expect(prismaMock.videoProgress.upsert).not.toHaveBeenCalled()
    })
  })
})
