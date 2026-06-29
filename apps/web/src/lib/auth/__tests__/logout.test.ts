import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Bağımlılıkları mock'la — node test ortamında window/fetch/supabase yok.
const signOut = vi.fn().mockResolvedValue(undefined)
const setUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}))
vi.mock('@/store/auth-store', () => ({
  useAuthStore: { getState: () => ({ setUser }) },
}))

import { performLogout } from '../logout'

describe('performLogout', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { location: { href: '' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('önce sunucu logout rotasını POST eder', async () => {
    await performLogout()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })

  it('client signOut + store temizliği yapar ve /auth/login\'e full-reload eder', async () => {
    await performLogout()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(setUser).toHaveBeenCalledWith(null)
    expect((globalThis as { window: { location: { href: string } } }).window.location.href).toBe('/auth/login')
  })

  it('sunucu rotası (fetch) hata verse de çıkışa devam eder', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    await performLogout()
    // fetch patlasa da çerez/yerel durum yine temizlenir ve yönlendirme yapılır
    expect(setUser).toHaveBeenCalledWith(null)
    expect((globalThis as { window: { location: { href: string } } }).window.location.href).toBe('/auth/login')
  })

  it('client signOut hata verse de yerel durumu temizler ve yönlendirir', async () => {
    signOut.mockRejectedValueOnce(new Error('network'))
    await performLogout()
    expect(setUser).toHaveBeenCalledWith(null)
    expect((globalThis as { window: { location: { href: string } } }).window.location.href).toBe('/auth/login')
  })

  it('redirectTo verilirse oraya yönlendirir (oturum zaman aşımı senaryosu)', async () => {
    await performLogout('/auth/login?reason=timeout')
    expect((globalThis as { window: { location: { href: string } } }).window.location.href).toBe('/auth/login?reason=timeout')
  })

  it('doğru sıra: önce sunucu rotası, sonra yönlendirme', async () => {
    const order: string[] = []
    fetchMock.mockImplementationOnce(async () => { order.push('fetch'); return { ok: true } })
    signOut.mockImplementationOnce(async () => { order.push('signOut') })
    setUser.mockImplementationOnce(() => { order.push('setUser') })
    await performLogout()
    expect(order).toEqual(['fetch', 'signOut', 'setUser'])
  })
})
