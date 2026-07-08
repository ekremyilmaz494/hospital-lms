import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as jose from 'jose'
import { verifyAccessToken } from '../verify-jwt'
import { getServerSupabaseUrl, getSupabaseCookieOptions } from '../onprem-config'

/**
 * On-prem auth kablolaması düzeltmelerini (Tier 1) regresyona karşı kilitler:
 *  - getServerSupabaseUrl: sunucu-taraf iç gateway URL'i (SUPABASE_URL öncelikli), bulutta NEXT_PUBLIC.
 *  - getSupabaseCookieOptions: on-prem'de sabit çerez adı, bulutta undefined (varsayılan korunur).
 *  - verifyAccessToken issuer kapısı: on-prem'de GoTrue iss'siz token GEÇER; bulutta issuer ZORUNLU kalır.
 */

const SECRET = 'test-jwt-secret-32-characters-long-xx' // secret-scanner-disable-line
const KEY = new TextEncoder().encode(SECRET)

async function signToken(opts: { iss?: string; aud?: string; sub?: string } = {}) {
  const b = new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.sub ?? 'user-123')
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
  if (opts.iss) b.setIssuer(opts.iss)
  return b.sign(KEY)
}

describe('getServerSupabaseUrl — sunucu-taraf iç gateway URL kapısı', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('on-prem: SUPABASE_URL (iç gateway) öncelikli', () => {
    vi.stubEnv('SUPABASE_URL', 'http://gateway:8000')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:8000')
    expect(getServerSupabaseUrl()).toBe('http://gateway:8000')
  })

  it('bulut: SUPABASE_URL yoksa NEXT_PUBLIC_SUPABASE_URL (davranış değişmez)', () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co')
    expect(getServerSupabaseUrl()).toBe('https://ref.supabase.co')
  })
})

describe('getSupabaseCookieOptions — çerez adı sabitleme', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('on-prem: sabit ad (sb- öneki + -auth-token deseni korunur)', () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    const opts = getSupabaseCookieOptions()
    expect(opts?.name).toBe('sb-onprem-auth-token')
    expect(opts?.name?.startsWith('sb-')).toBe(true)
    expect(opts?.name?.includes('-auth-token')).toBe(true)
  })

  it('bulut: undefined → @supabase/ssr varsayılanı korunur', () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    expect(getSupabaseCookieOptions()).toBeUndefined()
  })
})

describe('verifyAccessToken — issuer kapısı (on-prem GoTrue iss koymaz)', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_JWT_SECRET', SECRET)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:8000')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('on-prem: iss claim OLMAYAN HS256 token GEÇER (imza+aud doğru)', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    const token = await signToken({}) // iss yok — GoTrue self-host böyle üretir
    const res = await verifyAccessToken(token)
    expect(res?.sub).toBe('user-123')
  })

  it('bulut: iss claim OLMAYAN token REDDEDİLİR (issuer zorunlu)', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    const token = await signToken({}) // iss yok
    expect(await verifyAccessToken(token)).toBeNull()
  })

  it('bulut: DOĞRU iss ile token GEÇER (issuer eşleşir)', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    const token = await signToken({ iss: 'http://localhost:8000/auth/v1' })
    const res = await verifyAccessToken(token)
    expect(res?.sub).toBe('user-123')
  })

  it('on-prem: YANLIŞ aud reddedilir (imza doğru olsa da)', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    const token = await signToken({ aud: 'anon' })
    expect(await verifyAccessToken(token)).toBeNull()
  })
})
