import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * reset-attempt regresyon koruması.
 *
 * Kök neden (korunan): reset-attempt `currentAttempt: 0` yazıyordu; eski examAttempt
 * satırları (attemptNumber 1..N) dururken start route `newAttemptNumber=1` üretip
 * `@@unique([assignmentId, attemptNumber])` ihlal ediyor → 500, personel sınava giremiyordu.
 * Düzeltme: currentAttempt'e DOKUNMA, maxAttempts'i artır.
 *
 * Bu route ortak `grantAttempts` helper'ına geçti ($transaction + state-machine + bildirim +
 * bekleyen talep kapatma). Testler hem eski sözleşmeyi (currentAttempt dokunulmaz, passed reddi)
 * hem yeni davranışı (bildirim, locked reddi, rate-limit) kilitler.
 */

const { prismaMock, txMock, checkRateLimitMock } = vi.hoisted(() => {
  const txMock = {
    trainingAssignment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
    examAttemptRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  }
  return {
    txMock,
    prismaMock: { $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)) },
    checkRateLimitMock: vi.fn().mockResolvedValue(true),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: checkRateLimitMock }))
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
  withAdminRoute: (handler: (ctx: {
    request: Request
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request) => handler({
      request,
      dbUser: { id: 'admin-1', role: 'admin', organizationId: 'org-1' },
      organizationId: 'org-1',
      audit: vi.fn().mockResolvedValue(undefined),
    })
  },
}))

import { POST } from '../route'

function resetRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/admin/trainings/reset-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimitMock.mockResolvedValue(true)
})

describe('POST /api/admin/trainings/reset-attempt', () => {
  it('failed atamada maxAttempts artar, currentAttempt\'e DOKUNULMAZ + BİLDİRİM gider (KRİTİK)', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-1', userId: 'user-1', trainingId: 'tr-1',
      status: 'failed', currentAttempt: 3, maxAttempts: 3, originalMaxAttempts: 3,
      training: { title: 'Yangın Eğitimi' }, user: { firstName: 'Ayşe', lastName: 'Yıldız' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-1' }))

    expect(res.status).toBe(200)
    expect(txMock.trainingAssignment.update).toHaveBeenCalledOnce()

    const updateArgs = txMock.trainingAssignment.update.mock.calls[0][0] as { data: Record<string, unknown> }
    // maxAttempts = currentAttempt(3) + originalMaxAttempts(3) = 6
    expect(updateArgs.data.maxAttempts).toBe(6)
    expect(updateArgs.data.status).toBe('assigned')
    // KRİTİK: currentAttempt asla yazılmamalı (start route @@unique çakışması → 500).
    expect('currentAttempt' in updateArgs.data).toBe(false)
    // YENİ: personele bildirim gönderiliyor (eskiden yoktu).
    expect(txMock.notification.create).toHaveBeenCalledTimes(1)
  })

  it('originalMaxAttempts null ise maxAttempts fallback kullanılır', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-2', userId: 'user-1', trainingId: 'tr-1',
      status: 'in_progress', currentAttempt: 1, maxAttempts: 5, originalMaxAttempts: null,
      training: { title: 'KVKK' }, user: { firstName: 'Mehmet', lastName: 'Kaya' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-2' }))

    expect(res.status).toBe(200)
    const updateArgs = txMock.trainingAssignment.update.mock.calls[0][0] as { data: Record<string, unknown> }
    // currentAttempt(1) + maxAttempts(5) fallback = 6
    expect(updateArgs.data.maxAttempts).toBe(6)
  })

  it('passed atama reset edilemez — 400 döner', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-3', userId: 'user-1', trainingId: 'tr-1',
      status: 'passed', currentAttempt: 1, maxAttempts: 3, originalMaxAttempts: 3,
      training: { title: 'X' }, user: { firstName: 'A', lastName: 'B' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-3' }))

    expect(res.status).toBe(400)
    expect(txMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('locked atama reset edilemez — 400 döner', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-4', userId: 'user-1', trainingId: 'tr-1',
      status: 'locked', currentAttempt: 3, maxAttempts: 3, originalMaxAttempts: 3,
      training: { title: 'X' }, user: { firstName: 'A', lastName: 'B' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-4' }))

    expect(res.status).toBe(400)
    expect(txMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('atama bulunamazsa 404 döner', async () => {
    txMock.trainingAssignment.findFirst.mockResolvedValue(null)

    const res = await POST(resetRequest({ assignmentId: 'yok' }))

    expect(res.status).toBe(404)
    expect(txMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('assignmentId eksikse 400 döner (transaction çalışmaz)', async () => {
    const res = await POST(resetRequest({}))

    expect(res.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rate-limit aşılırsa 429 döner', async () => {
    checkRateLimitMock.mockResolvedValueOnce(false)
    const res = await POST(resetRequest({ assignmentId: 'assign-1' }))
    expect(res.status).toBe(429)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
