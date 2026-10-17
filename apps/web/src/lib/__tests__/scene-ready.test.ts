import { afterEach, describe, it, expect, vi } from 'vitest'
import { getDeepLinkTarget, parseDeepLinkHash } from '@/lib/scene-ready'

describe('parseDeepLinkHash', () => {
  it('bölüm id\'sini # olmadan döner', () => {
    expect(parseDeepLinkHash('#egitim')).toBe('egitim')
    expect(parseDeepLinkHash('#guvenlik')).toBe('guvenlik')
  })

  it('# öneki olmayan değeri de kabul eder', () => {
    expect(parseDeepLinkHash('sss')).toBe('sss')
  })

  it('#hero derin link sayılmaz (giriş animasyonu korunur)', () => {
    expect(parseDeepLinkHash('#hero')).toBeNull()
  })

  it('boş hash ve yalnız "#" için null döner', () => {
    expect(parseDeepLinkHash('')).toBeNull()
    expect(parseDeepLinkHash('#')).toBeNull()
  })

  it('yüzde-kodlu Türkçe karakteri çözer', () => {
    expect(parseDeepLinkHash('#%C3%A7')).toBe('ç')
  })

  it('bozuk yüzde-kodlamada hata fırlatmaz, null döner', () => {
    expect(() => parseDeepLinkHash('#%E0%A4%A')).not.toThrow()
    expect(parseDeepLinkHash('#%E0%A4%A')).toBeNull()
  })
})

describe('getDeepLinkTarget', () => {
  it('SSR\'da (window yok) null döner', () => {
    expect(getDeepLinkTarget()).toBeNull()
  })
})

describe('getDeepLinkTarget (tarayıcı benzetimi)', () => {
  /** Node ortamında window/document taklidi; modül durumu (deepLinkArmed) her testte sıfırlanır. */
  async function setup(hash: string, existingIds: string[]) {
    const scrollIntoView = vi.fn()
    const style = { overflow: '', scrollBehavior: '' }
    vi.stubGlobal('window', {
      location: { hash },
      scrollTo: vi.fn(),
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('document', {
      documentElement: { style },
      body: { style: { overflow: '' } },
      getElementById: (id: string) => (existingIds.includes(id) ? { scrollIntoView } : null),
    })
    vi.resetModules()
    const mod = await import('@/lib/scene-ready')
    return { ...mod, scrollIntoView }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('DOM\'da olmayan id için null döner (giriş animasyonu korunur)', async () => {
    const m = await setup('#yok-boyle-bir-id', ['egitim'])
    m.lockScroll()
    expect(m.getDeepLinkTarget()).toBeNull()
    expect(m.scrollToDeepLinkTarget()).toBe(false)
  })

  it('DOM\'da olan id için id\'yi döner', async () => {
    const m = await setup('#egitim', ['egitim'])
    m.lockScroll()
    expect(m.getDeepLinkTarget()).toBe('egitim')
  })

  it('sayfa girişi (lockScroll) olmadan bayat hash derin link sayılmaz', async () => {
    const m = await setup('#kanit', ['kanit'])
    expect(m.getDeepLinkTarget()).toBeNull()
    expect(m.scrollToDeepLinkTarget()).toBe(false)
  })

  it('hedefe inildikten sonra tüketilir; yeni sayfa girişinde (lockScroll) tekrar silahlanır', async () => {
    const m = await setup('#egitim', ['egitim'])
    m.lockScroll()
    expect(m.scrollToDeepLinkTarget()).toBe(true)
    expect(m.scrollIntoView).toHaveBeenCalledTimes(1)
    // Resize kaynaklı remount: bayat hash yoksayılır
    expect(m.getDeepLinkTarget()).toBeNull()
    expect(m.scrollToDeepLinkTarget()).toBe(false)
    // Başka sayfadan yeni /#egitim girişi
    m.lockScroll()
    expect(m.getDeepLinkTarget()).toBe('egitim')
  })
})
