import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'

/**
 * /api/admin/training-categories — GET'te DB write YASAK (CLAUDE.md):
 *
 *  - GET: DB boşsa varsayılanları YAZMADAN (id:null) salt-okunur döndürür.
 *    `createMany` ÇAĞRILMAMALI — bu, "GET'te write yok" sözleşmesinin kilidi.
 *  - POST: DB boşsa önce lazy-seed (ensureDefaultTrainingCategories) çalışır,
 *    sonra yeni kategori eklenir.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingCategory: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('@/lib/api-helpers', () => ({
  jsonResponse: (data: unknown, status = 200, headers?: Record<string, string>) =>
    Response.json(data, { status, headers }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
  parseBody: (request: Request) => request.json(),
}))

vi.mock('@/lib/api-handler', () => ({
  withAdminRoute: (handler: (ctx: {
    request: Request
    organizationId: string
    audit: () => Promise<void>
  }) => Promise<Response>) => {
    return async (request: Request) => handler({
      request,
      organizationId: 'org-1',
      audit: vi.fn().mockResolvedValue(undefined),
    })
  },
}))

import { GET, POST } from '../route'

describe('GET /api/admin/training-categories — GET\'te write yok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DB boşken varsayılanları YAZMADAN döndürür (createMany çağrılmaz)', async () => {
    prismaMock.trainingCategory.findMany.mockResolvedValue([])

    const res = await GET(new Request('http://localhost/api/admin/training-categories'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(TRAINING_CATEGORIES.length)
    expect(body.every((c: { id: string | null }) => c.id === null)).toBe(true)
    expect(body.every((c: { isDefault: boolean }) => c.isDefault === true)).toBe(true)
    // Kritik: GET hiçbir şey yazmamalı
    expect(prismaMock.trainingCategory.createMany).not.toHaveBeenCalled()
  })

  it('DB doluyken DB kayıtlarını döndürür (createMany çağrılmaz)', async () => {
    prismaMock.trainingCategory.findMany.mockResolvedValue([
      { id: 'cat-1', value: 'enfeksiyon', label: 'Enfeksiyon', icon: 'Shield', order: 0, isDefault: true },
    ])

    const res = await GET(new Request('http://localhost/api/admin/training-categories'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('cat-1')
    expect(prismaMock.trainingCategory.createMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/training-categories — lazy-seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function postRequest(body: Record<string, unknown>): Request {
    return new Request('http://localhost/api/admin/training-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('DB boşken önce varsayılanları seed eder, sonra yeni kategoriyi ekler', async () => {
    prismaMock.trainingCategory.count.mockResolvedValue(0)          // ensureDefault: boş
    prismaMock.trainingCategory.createMany.mockResolvedValue({ count: TRAINING_CATEGORIES.length })
    prismaMock.trainingCategory.findUnique.mockResolvedValue(null)  // unique kontrol: yok
    prismaMock.trainingCategory.findFirst.mockResolvedValue({ order: 7 })
    prismaMock.trainingCategory.create.mockResolvedValue({
      id: 'new-1', value: 'kardiyoloji', label: 'Kardiyoloji', icon: 'Heart', order: 8, isDefault: false,
    })

    const res = await POST(postRequest({ label: 'Kardiyoloji', icon: 'Heart' }))

    expect(res.status).toBe(201)
    expect(prismaMock.trainingCategory.createMany).toHaveBeenCalledOnce() // lazy-seed
    expect(prismaMock.trainingCategory.create).toHaveBeenCalledOnce()     // yeni kategori
  })

  it('DB doluyken seed atlanır, sadece yeni kategori eklenir', async () => {
    prismaMock.trainingCategory.count.mockResolvedValue(8)          // ensureDefault: dolu → seed yok
    prismaMock.trainingCategory.findUnique.mockResolvedValue(null)
    prismaMock.trainingCategory.findFirst.mockResolvedValue({ order: 7 })
    prismaMock.trainingCategory.create.mockResolvedValue({
      id: 'new-2', value: 'kardiyoloji', label: 'Kardiyoloji', icon: 'Heart', order: 8, isDefault: false,
    })

    const res = await POST(postRequest({ label: 'Kardiyoloji', icon: 'Heart' }))

    expect(res.status).toBe(201)
    expect(prismaMock.trainingCategory.createMany).not.toHaveBeenCalled()
    expect(prismaMock.trainingCategory.create).toHaveBeenCalledOnce()
  })
})
