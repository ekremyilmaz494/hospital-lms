import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Admin Trainings PATCH — endDate uzatımı sonrası expired attempt revive sözleşmesi.
 *
 * **KÖK NEDEN** (2026-05-17 Devakent RADYASYON incident):
 * Admin endDate'i uzatıyor ama cron'un daha önce 'expired' işaretlediği attempt'ler
 * geri açılmıyor → 6 personel kilitli kalıyor. Bu test, PATCH'in
 * `oldEndDate < now < newEndDate` durumunda raw SQL revive'ı tetiklediğini doğrular.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    training: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(0),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
// Monorepo geçişi sonrası Prisma client henüz generate edilmemiş olabilir;
// route.ts'in `import { Prisma } from '@/generated/prisma/client'` çağrısını mock'la.
vi.mock('@/generated/prisma/client', () => ({ Prisma: { DbNull: null } }))
vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  invalidateOrgCache: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/training-video-url', () => ({
  resolveTrainingVideoUrl: vi.fn().mockResolvedValue(''),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/validations', () => ({
  updateTrainingSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
}))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: async (req: Request) => {
    try { return await req.json() } catch { return null }
  },
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: <P>(handler: (ctx: {
    request: Request
    params: Promise<P>
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request, { params }: { params: Promise<P> }) => {
      return handler({
        request,
        params: Promise.resolve(await params),
        dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
        organizationId: 'org-1',
        audit: vi.fn().mockResolvedValue(undefined),
      })
    }
  },
}))

import { PATCH } from '../route'

function patchRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/admin/trainings/training-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // $transaction default: callback'i çağır, sonucu döndür
  prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock))
  prismaMock.$executeRaw.mockResolvedValue(0)
  prismaMock.training.update.mockResolvedValue({ id: 'training-1', endDate: new Date() })
})

describe('Admin PATCH /api/admin/trainings/[id] — expired attempt revive (Devakent regression)', () => {
  it('endDate UZATIMI (eski geçmiş, yeni gelecek) → revive SQL\'leri tetiklenir', async () => {
    const oldEndDate = new Date('2026-05-16T23:59:59Z') // geçmiş (now > this)
    const newEndDate = new Date('2026-05-25T23:59:59Z') // gelecek

    prismaMock.training.findFirst.mockResolvedValueOnce({
      id: 'training-1',
      organizationId: 'org-1',
      endDate: oldEndDate,
    })

    // Now mock'la — 2026-05-18 (oldEndDate geçmiş, newEndDate gelecek)
    const fakeNow = new Date('2026-05-18T10:00:00Z')
    vi.setSystemTime(fakeNow)

    const res = await PATCH(
      patchRequest({ endDate: newEndDate.toISOString() }),
      { params: Promise.resolve({ id: 'training-1' }) },
    )

    expect(res.status).toBe(200)

    // KRİTİK: revive SQL'leri çağrılmalı (exam_attempts + training_assignments)
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2)
    // İlk SQL: exam_attempts revive — postExamScore + postExamCompletedAt temizleme
    const firstSqlParts = prismaMock.$executeRaw.mock.calls[0][0] as string[] | { join: () => string }
    const firstSql = Array.isArray(firstSqlParts) ? firstSqlParts.join(' ') : String(firstSqlParts)
    expect(firstSql).toMatch(/exam_attempts/)
    expect(firstSql).toMatch(/post_exam_completed_at = NULL/)
    expect(firstSql).toMatch(/signed_at IS NULL/) // imzalı olanlara dokunma
    expect(firstSql).toMatch(/post_exam_started_at IS NULL/) // gerçek sınava giren'i atla

    // İkinci SQL: training_assignments revive — 'assigned' → 'in_progress'
    const secondSqlParts = prismaMock.$executeRaw.mock.calls[1][0] as string[] | { join: () => string }
    const secondSql = Array.isArray(secondSqlParts) ? secondSqlParts.join(' ') : String(secondSqlParts)
    expect(secondSql).toMatch(/training_assignments/)
    expect(secondSql).toMatch(/in_progress/)

    vi.useRealTimers()
  })

  it('endDate KISALTMA (uzatım değil) → revive tetiklenmez', async () => {
    const oldEndDate = new Date('2026-05-30T23:59:59Z') // gelecek
    const newEndDate = new Date('2026-05-25T23:59:59Z') // daha yakın gelecek

    prismaMock.training.findFirst.mockResolvedValueOnce({
      id: 'training-1',
      organizationId: 'org-1',
      endDate: oldEndDate,
    })

    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'))

    await PATCH(
      patchRequest({ endDate: newEndDate.toISOString() }),
      { params: Promise.resolve({ id: 'training-1' }) },
    )

    // oldEndDate gelecek (geçmiş değil) → uzatım koşulu false → revive yok
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('endDate hiç gönderilmedi (title vs. update) → revive tetiklenmez', async () => {
    prismaMock.training.findFirst.mockResolvedValueOnce({
      id: 'training-1',
      organizationId: 'org-1',
      endDate: new Date('2026-05-16T23:59:59Z'),
    })

    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'))

    await PATCH(
      patchRequest({ title: 'Yeni Başlık' }),
      { params: Promise.resolve({ id: 'training-1' }) },
    )

    expect(prismaMock.$executeRaw).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
