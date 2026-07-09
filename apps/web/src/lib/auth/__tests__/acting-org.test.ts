import { describe, it, expect, beforeAll } from 'vitest'
import {
  makeActingOrgToken,
  verifyActingOrgToken,
  readActingOrgCookie,
  ACTING_ORG_COOKIE,
  ACTING_ORG_TTL_SECONDS,
} from '../acting-org'

const ORG = '11111111-1111-1111-1111-111111111111'
const UID = '22222222-2222-2222-2222-222222222222'
const NOW = 1_700_000_000_000

beforeAll(() => {
  // HMAC secret'i (üretimde SUPABASE_SERVICE_ROLE_KEY). Test için deterministik.
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-hmac-secret-key'
})

describe('acting-org token imzalama/doğrulama', () => {
  it('round-trip: geçerli token orgId döner', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    expect(verifyActingOrgToken(token, UID, NOW + 1000)).toBe(ORG)
  })

  it('uid bağlama: kaçan cookie başka kullanıcıda geçersiz', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    expect(verifyActingOrgToken(token, 'different-uid', NOW + 1000)).toBeNull()
  })

  it('kurcalanan imza reddedilir', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa')
    expect(verifyActingOrgToken(tampered, UID, NOW + 1000)).toBeNull()
  })

  it('orgId kurcalanırsa (imza eşleşmez) reddedilir', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    const parts = token.split('.')
    parts[0] = '99999999-9999-9999-9999-999999999999'
    expect(verifyActingOrgToken(parts.join('.'), UID, NOW + 1000)).toBeNull()
  })

  it('süresi dolan token reddedilir', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    const afterExpiry = NOW + (ACTING_ORG_TTL_SECONDS + 1) * 1000
    expect(verifyActingOrgToken(token, UID, afterExpiry)).toBeNull()
  })

  it('TTL sınırında hâlâ geçerli, hemen sonrasında geçersiz', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    const justBefore = NOW + (ACTING_ORG_TTL_SECONDS - 1) * 1000
    const justAfter = NOW + (ACTING_ORG_TTL_SECONDS + 1) * 1000
    expect(verifyActingOrgToken(token, UID, justBefore)).toBe(ORG)
    expect(verifyActingOrgToken(token, UID, justAfter)).toBeNull()
  })

  it('bozuk/eksik token null döner', () => {
    expect(verifyActingOrgToken(null, UID, NOW)).toBeNull()
    expect(verifyActingOrgToken(undefined, UID, NOW)).toBeNull()
    expect(verifyActingOrgToken('', UID, NOW)).toBeNull()
    expect(verifyActingOrgToken('a.b.c', UID, NOW)).toBeNull() // 3 parça
    expect(verifyActingOrgToken('a.b.c.d.e', UID, NOW)).toBeNull() // 5 parça
    expect(verifyActingOrgToken(`${ORG}.${UID}.notanumber.sig`, UID, NOW)).toBeNull()
  })

  it('farklı secret ile üretilen token doğrulanamaz', () => {
    const token = makeActingOrgToken(ORG, UID, NOW)
    const orig = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'baska-secret'
    try {
      expect(verifyActingOrgToken(token, UID, NOW + 1000)).toBeNull()
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = orig
    }
  })
})

describe('readActingOrgCookie', () => {
  const req = (cookie: string | null) =>
    new Request('https://x.test/api/admin/x', cookie ? { headers: { cookie } } : undefined)

  it('cookie yoksa null', () => {
    expect(readActingOrgCookie(req(null))).toBeNull()
  })

  it('acting-org cookie değerini çıkarır (diğer cookie\'ler arasından)', () => {
    const val = makeActingOrgToken(ORG, UID, NOW)
    const header = `sb-ref-auth-token=abc; ${ACTING_ORG_COOKIE}=${val}; x-org-slug=devakent`
    expect(readActingOrgCookie(req(header))).toBe(val)
  })

  it('başka cookie\'ler varsa ama acting-org yoksa null', () => {
    expect(readActingOrgCookie(req('foo=bar; baz=qux'))).toBeNull()
  })
})
