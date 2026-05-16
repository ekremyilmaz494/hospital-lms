import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireRole, safePagination, errorResponse, jsonResponse, parseBody } from '../api-helpers'

// Supabase ve Prisma bağımlılıkları — getAuthUser testlerinde lazım
vi.mock('../supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

describe('requireRole', () => {
  it('izin verilen rol için null döndürür', () => {
    expect(requireRole('admin', ['admin', 'super_admin'])).toBeNull()
    expect(requireRole('super_admin', ['super_admin'])).toBeNull()
  })

  it('izin verilmeyen rol için 403 response döndürür', async () => {
    const result = requireRole('staff', ['admin'])
    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(body.error).toBe('Forbidden')
  })

  it('boş izin listesiyle her zaman hata döndürür', async () => {
    const result = requireRole('admin', [])
    expect(result).not.toBeNull()
    const body = await result!.json()
    expect(body.error).toBe('Forbidden')
  })
})

describe('safePagination', () => {
  it('varsayılan değerleri döndürür', () => {
    const params = new URLSearchParams()
    const result = safePagination(params)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.search).toBe('')
    expect(result.skip).toBe(0)
  })

  it('geçerli sayfalama parametrelerini ayrıştırır', () => {
    const params = new URLSearchParams({ page: '3', limit: '50' })
    const result = safePagination(params)
    expect(result.page).toBe(3)
    expect(result.limit).toBe(50)
    expect(result.skip).toBe(100) // (3-1) * 50
  })

  it('limit 100 ile sınırlar', () => {
    const params = new URLSearchParams({ limit: '999' })
    const result = safePagination(params)
    expect(result.limit).toBe(100)
  })

  it('page 0 veya negatif olduğunda 1 kullanır', () => {
    const params = new URLSearchParams({ page: '0' })
    expect(safePagination(params).page).toBe(1)

    const params2 = new URLSearchParams({ page: '-5' })
    expect(safePagination(params2).page).toBe(1)
  })

  it('limit 0 olduğunda 1 kullanır', () => {
    const params = new URLSearchParams({ limit: '0' })
    expect(safePagination(params).limit).toBe(1)
  })

  it('search parametresini 200 karakterle kırpar', () => {
    const params = new URLSearchParams({ search: 'a'.repeat(300) })
    expect(safePagination(params).search.length).toBe(200)
  })

  it('arama metnini doğru döndürür', () => {
    const params = new URLSearchParams({ search: 'ahmet' })
    expect(safePagination(params).search).toBe('ahmet')
  })
})

describe('errorResponse', () => {
  it('varsayılan 400 status ile hata döndürür', async () => {
    const response = errorResponse('Geçersiz istek')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Geçersiz istek')
  })

  it('özel status kodu kullanır', async () => {
    const response = errorResponse('Yetkisiz', 401)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Yetkisiz')
  })

  it('404 ve 503 status kodlarını destekler', async () => {
    expect(errorResponse('Bulunamadı', 404).status).toBe(404)
    expect(errorResponse('Servis hatası', 503).status).toBe(503)
  })
})

describe('jsonResponse', () => {
  it('varsayılan 200 status ile JSON döndürür', async () => {
    const response = jsonResponse({ id: 1, name: 'Test' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ id: 1, name: 'Test' })
  })

  it('201 status kodu ile çalışır', async () => {
    const response = jsonResponse({ created: true }, 201)
    expect(response.status).toBe(201)
  })

  it('dizi verisi döndürür', async () => {
    const data = [{ id: 1 }, { id: 2 }]
    const response = jsonResponse(data)
    const body = await response.json()
    expect(body).toHaveLength(2)
  })
})

describe('parseBody', () => {
  it('geçerli JSON body ayrıştırır', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', value: 42 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody<{ name: string; value: number }>(request)
    expect(result).toEqual({ name: 'Test', value: 42 })
  })

  it('geçersiz JSON için null döndürür', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: 'gecersiz json {{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(request)
    expect(result).toBeNull()
  })

  it('boş body için null döndürür', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseBody(request)
    expect(result).toBeNull()
  })
})
