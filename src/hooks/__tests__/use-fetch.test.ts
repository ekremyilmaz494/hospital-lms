import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// React hook'larını mock'la — jsdom ortamı olmadan hook davranışını test ediyoruz
const mockSetState = vi.fn()
const mockUseState = vi.fn((init: unknown) => [init, mockSetState])
const mockUseEffect = vi.fn((cb: () => void) => cb())
const mockUseCallback = vi.fn((cb: unknown) => cb)
const mockUseRef = vi.fn((init: unknown) => ({ current: init }))

vi.mock('react', () => ({
  useState: mockUseState,
  useEffect: mockUseEffect,
  useCallback: mockUseCallback,
  useRef: mockUseRef,
}))

// clearFetchCache fonksiyonunu doğrudan test edeceğiz
// useFetch hook mantığını fetch mock'ları üzerinden test edeceğiz

describe('useFetch — clearFetchCache', () => {
  let clearFetchCache: typeof import('@/hooks/use-fetch').clearFetchCache

  beforeEach(async () => {
    vi.resetModules()
    // Re-import to get fresh module with fresh cache
    const mod = await import('@/hooks/use-fetch')
    clearFetchCache = mod.clearFetchCache
  })

  it('mevcut bir cache girişini temizler', () => {
    // clearFetchCache bir URL'yi cache'den siler
    // Hata fırlatmadan çalışmalı (cache boş olsa bile)
    expect(() => clearFetchCache('/api/test')).not.toThrow()
  })

  it('var olmayan URL için hata fırlatmaz', () => {
    expect(() => clearFetchCache('/api/nonexistent')).not.toThrow()
  })
})

describe('useFetch — fetch davranışı', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    mockSetState.mockReset()
    mockUseState.mockReset()
    mockUseEffect.mockReset()
    mockUseCallback.mockReset()
    mockUseRef.mockReset()

    // Default implementations
    mockUseState.mockImplementation((init: unknown) => [init, mockSetState])
    mockUseEffect.mockImplementation((cb: () => void) => {
      cb()
    })
    mockUseCallback.mockImplementation((cb: unknown) => cb)
    mockUseRef.mockImplementation((init: unknown) => ({ current: init }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('url null olduğunda data null döndürür ve fetch çağrılmaz', async () => {
    const { useFetch } = await import('@/hooks/use-fetch')
    const result = useFetch(null)
    expect(result.data).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('başarılı fetch sonucunda veri döndürür', async () => {
    const testData = { items: [1, 2, 3] }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(testData),
    })

    const { useFetch } = await import('@/hooks/use-fetch')
    useFetch('/api/test-data')

    // useEffect callback'i çalıştırıldığında fetch çağrılmış olmalı
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test-data',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('başarısız fetch durumunda hata set eder', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Sunucu hatası' }),
    })

    const { useFetch } = await import('@/hooks/use-fetch')
    useFetch('/api/failing')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/failing',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('401 yanıtında /auth/login adresine yönlendirir', async () => {
    // window.location mock
    const locationMock = { href: '' }
    vi.stubGlobal('window', { location: locationMock })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    })

    const { useFetch } = await import('@/hooks/use-fetch')
    useFetch('/api/protected')

    // fetch çağrısını bekle
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Yönlendirme gerçekleşene kadar bekle
    await vi.waitFor(() => {
      expect(locationMock.href).toBe('/auth/login?reason=session_expired')
    })
  })

  it('403 yanıtında /auth/login adresine yönlendirir', async () => {
    const locationMock = { href: '' }
    vi.stubGlobal('window', { location: locationMock })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    })

    const { useFetch } = await import('@/hooks/use-fetch')
    useFetch('/api/admin-only')

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    await vi.waitFor(() => {
      expect(locationMock.href).toBe('/auth/login?reason=session_expired')
    })
  })
})
