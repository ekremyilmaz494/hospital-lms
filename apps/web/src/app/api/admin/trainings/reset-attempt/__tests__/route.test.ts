import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * reset-attempt regresyon koruması (Plan: birden-fazla-agentla... Faz 2, Adım 6).
 *
 * Kök neden: reset-attempt `currentAttempt: 0` yazıyordu; eski examAttempt
 * satırları (attemptNumber 1..N) dururken start route `newAttemptNumber=1`
 * üretip `@@unique([assignmentId, attemptNumber])` ihlal ediyor → 500, personel
 * sınava giremiyordu. Düzeltme: currentAttempt'e DOKUNMA, maxAttempts'i artır.
 *
 * Bu testler fix'in geri gelmemesini garanti eder.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingAssignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
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
    params: Record<string, never>
    dbUser: { id: string; role: string; organizationId: string }
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request) => handler({
      request,
      params: {},
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
  prismaMock.trainingAssignment.update.mockResolvedValue({})
})

describe('POST /api/admin/trainings/reset-attempt', () => {
  it('failed atamada maxAttempts artar, currentAttempt\'e DOKUNULMAZ (KRİTİK)', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      status: 'failed',
      currentAttempt: 3,
      maxAttempts: 3,
      originalMaxAttempts: 3,
      training: { title: 'Yangın Eğitimi', maxAttempts: 3 },
      user: { firstName: 'Ayşe', lastName: 'Yıldız' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-1' }))

    expect(res.status).toBe(200)
    expect(prismaMock.trainingAssignment.update).toHaveBeenCalledOnce()

    const updateArgs = prismaMock.trainingAssignment.update.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    // maxAttempts = currentAttempt(3) + originalMaxAttempts(3) = 6
    expect(updateArgs.data.maxAttempts).toBe(6)
    expect(updateArgs.data.status).toBe('assigned')
    // KRİTİK: currentAttempt asla 0'a (veya herhangi bir değere) yazılmamalı —
    // aksi halde start route @@unique çakışmasıyla 500 döner.
    expect('currentAttempt' in updateArgs.data).toBe(false)
  })

  it('originalMaxAttempts null ise maxAttempts fallback kullanılır', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-2',
      status: 'in_progress',
      currentAttempt: 1,
      maxAttempts: 5,
      originalMaxAttempts: null,
      training: { title: 'KVKK', maxAttempts: 5 },
      user: { firstName: 'Mehmet', lastName: 'Kaya' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-2' }))

    expect(res.status).toBe(200)
    const updateArgs = prismaMock.trainingAssignment.update.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    // currentAttempt(1) + maxAttempts(5) fallback = 6
    expect(updateArgs.data.maxAttempts).toBe(6)
  })

  it('passed atama reset edilemez — state machine 400 döner', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue({
      id: 'assign-3',
      status: 'passed',
      currentAttempt: 1,
      maxAttempts: 3,
      originalMaxAttempts: 3,
      training: { title: 'X', maxAttempts: 3 },
      user: { firstName: 'A', lastName: 'B' },
    })

    const res = await POST(resetRequest({ assignmentId: 'assign-3' }))

    expect(res.status).toBe(400)
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('atama bulunamazsa 404 döner', async () => {
    prismaMock.trainingAssignment.findFirst.mockResolvedValue(null)

    const res = await POST(resetRequest({ assignmentId: 'yok' }))

    expect(res.status).toBe(404)
    expect(prismaMock.trainingAssignment.update).not.toHaveBeenCalled()
  })

  it('assignmentId eksikse 400 döner', async () => {
    const res = await POST(resetRequest({}))

    expect(res.status).toBe(400)
    expect(prismaMock.trainingAssignment.findFirst).not.toHaveBeenCalled()
  })
})
