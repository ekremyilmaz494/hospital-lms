import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getBrowserRuntimeConfig,
  readBrowserConfig,
  serializeBrowserConfigScript,
  type OnpremBrowserConfig,
} from '../onprem-config'

/**
 * NEXT_PUBLIC runtime-config köprüsü (on-prem tek generic imaj). Bulut yolunun
 * (isOnPrem=false / window yok) DEĞİŞMEDİĞİNİ ve on-prem enjeksiyonunun çalıştığını kilitler.
 */

beforeEach(() => {
  vi.unstubAllEnvs()
})
afterEach(() => {
  vi.unstubAllEnvs()
  delete (globalThis as { window?: unknown }).window
})

describe('getBrowserRuntimeConfig — sunucu runtime okuma', () => {
  it('bulut (isOnPrem=false) → null (baked NEXT_PUBLIC kullanılır)', () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_URL', 'http://x:8000')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_ANON_KEY', 'k')
    expect(getBrowserRuntimeConfig()).toBeNull()
  })

  it('on-prem + zorunlu alanlar dolu → config döner', () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_URL', 'http://lms.hastane.local:8000')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_ANON_KEY', 'anon-jwt')
    vi.stubEnv('ONPREM_PUBLIC_STORAGE_HOST', 'http://lms.hastane.local:9000')
    vi.stubEnv('ONPREM_PUBLIC_APP_URL', 'http://lms.hastane.local:3000')
    vi.stubEnv('ONPREM_PUBLIC_BASE_DOMAIN', 'lms.hastane.local:3000')
    expect(getBrowserRuntimeConfig()).toEqual({
      supabaseUrl: 'http://lms.hastane.local:8000',
      supabaseAnonKey: 'anon-jwt',
      storageHost: 'http://lms.hastane.local:9000',
      appUrl: 'http://lms.hastane.local:3000',
      baseDomain: 'lms.hastane.local:3000',
    })
  })

  it('on-prem ama anon key eksik → null (fail-safe, yarım config enjekte edilmez)', () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_URL', 'http://x:8000')
    vi.stubEnv('ONPREM_PUBLIC_SUPABASE_ANON_KEY', '')
    expect(getBrowserRuntimeConfig()).toBeNull()
  })
})

describe('serializeBrowserConfigScript', () => {
  const cfg: OnpremBrowserConfig = {
    supabaseUrl: 'http://x:8000',
    supabaseAnonKey: 'k',
    storageHost: 'http://x:9000',
    appUrl: 'http://x:3000',
    baseDomain: 'x:3000',
  }

  it('null → boş string (script hiç basılmaz)', () => {
    expect(serializeBrowserConfigScript(null)).toBe('')
  })

  it('config → window.__ONPREM_CONFIG__ ataması + değer içerir', () => {
    const s = serializeBrowserConfigScript(cfg)
    expect(s.startsWith('window.__ONPREM_CONFIG__=')).toBe(true)
    expect(s).toContain('http://x:8000')
  })

  it('< karakteri kaçırılır (</script> ile script-break XSS önlemi)', () => {
    const s = serializeBrowserConfigScript({ ...cfg, supabaseUrl: 'http://x/</script>' })
    expect(s).not.toContain('</script>')
    expect(s).toContain('\\u003c/script>')
  })
})

describe('readBrowserConfig — izomorfik tarayıcı okuma', () => {
  it('window yoksa (SSR) → null', () => {
    expect(readBrowserConfig()).toBeNull()
  })

  it('window.__ONPREM_CONFIG__ set → döner', () => {
    ;(globalThis as { window?: unknown }).window = {
      __ONPREM_CONFIG__: { supabaseUrl: 'http://x:8000' },
    }
    expect(readBrowserConfig()).toMatchObject({ supabaseUrl: 'http://x:8000' })
  })

  it('window var ama config yok → null', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(readBrowserConfig()).toBeNull()
  })
})
