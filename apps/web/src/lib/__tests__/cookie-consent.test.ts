import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_KEY,
  COOKIE_PREFS_KEY,
  ESSENTIAL_ONLY,
  hasStoredConsent,
  openConsentSettings,
  readConsentPrefs,
  saveConsentPrefs,
} from '../cookie-consent'

// Node ortamı: window = EventTarget + Map tabanlı localStorage
function fakeWindow(opts: { throwOnStorage?: boolean } = {}) {
  const store = new Map<string, string>()
  const target = new EventTarget()
  const localStorage = {
    getItem: (k: string) => {
      if (opts.throwOnStorage) throw new Error('SecurityError')
      return store.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (opts.throwOnStorage) throw new Error('SecurityError')
      store.set(k, v)
    },
  }
  vi.stubGlobal('window', Object.assign(target, { localStorage }))
  return store
}

describe('cookie-consent', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('onay yokken yalnız zorunlu çerezler', () => {
    fakeWindow()
    expect(hasStoredConsent()).toBe(false)
    expect(readConsentPrefs()).toEqual(ESSENTIAL_ONLY)
  })

  it('kaydeder, okur ve değişikliği yayınlar', () => {
    const store = fakeWindow()
    const seen: unknown[] = []
    window.addEventListener(CONSENT_CHANGE_EVENT, (e) => seen.push((e as CustomEvent).detail))

    saveConsentPrefs({ essential: true, functional: false, analytics: true })

    expect(store.get(COOKIE_CONSENT_KEY)).toBe('true')
    expect(readConsentPrefs()).toEqual({ essential: true, functional: false, analytics: true })
    expect(seen).toEqual([{ essential: true, functional: false, analytics: true }])
  })

  it('bozuk veya eski biçimli kayıtta güvenli varsayılana döner', () => {
    const store = fakeWindow()
    store.set(COOKIE_CONSENT_KEY, 'true')
    store.set(COOKIE_PREFS_KEY, '{bozuk')
    expect(readConsentPrefs()).toEqual(ESSENTIAL_ONLY)
    store.set(COOKIE_PREFS_KEY, JSON.stringify({ analytics: 'yes' }))
    expect(readConsentPrefs().analytics).toBe(false)
  })

  it('depolama erişimi engelliyken fırlatmaz, olayı yine yayınlar', () => {
    fakeWindow({ throwOnStorage: true })
    const onChange = vi.fn()
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    expect(() => saveConsentPrefs(ESSENTIAL_ONLY)).not.toThrow()
    expect(readConsentPrefs()).toEqual(ESSENTIAL_ONLY)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('ayarları yeniden açma olayı yayınlanır', () => {
    fakeWindow()
    const onOpen = vi.fn()
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    openConsentSettings()
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
