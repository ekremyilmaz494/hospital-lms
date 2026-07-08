import { describe, it, expect, vi, afterEach } from 'vitest'
import { verifyLicenseJwt } from '@/lib/license/verify'
import { usingDevLicenseKeys } from '@/lib/license/keys'
import { isReadonlyWriteExempt } from '@/lib/license/enforcement'

/**
 * Güvenlik denetimi (2026-07) düzeltmelerini regresyona karşı kilitler:
 * J — üretim+on-prem'de DEV placeholder anahtarlarla doğrulama reddi (fail-closed).
 * P — READONLY yazma-muafiyeti regex'inin segment sınırına sabitlenmesi.
 */

describe('J — forgeable dev-anahtar üretim guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('gömülü anahtarlar ÜRETİM (anahtar töreni 2026-07-08 yapıldı — dev placeholder DEĞİL)', () => {
    expect(usingDevLicenseKeys()).toBe(false)
  })

  it('üretim anahtarı + on-prem + production → dev-guard TETİKLENMEZ, imza kontrolüne geçer', async () => {
    // Tören sonrası usingDevLicenseKeys()=false → dev_keys_in_production guard'ı devreye
    // girmez; doğrulama gerçek imza kontrolüne ilerler (bogus JWT → signature_invalid).
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('ALLOW_DEV_LICENSE_KEYS', '')
    await expect(verifyLicenseJwt('a.b.c')).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })

  it('ALLOW_DEV_LICENSE_KEYS=true → guard atlanır, imza kontrolüne geçer (CI/dev kaçışı)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('ALLOW_DEV_LICENSE_KEYS', 'true')
    await expect(verifyLicenseJwt('a.b.c')).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })

  it('bulut modu (onprem değil) → guard atlanır (parite bozulmaz)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_MODE', '')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    await expect(verifyLicenseJwt('a.b.c')).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })

  it('geliştirme (NODE_ENV!=production) → guard atlanır', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    await expect(verifyLicenseJwt('a.b.c')).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })
})

describe('P — READONLY yazma-muafiyeti regex sabitlemesi', () => {
  it('gerçek sınav-ilerleme yazmaları muaf kalır', () => {
    expect(isReadonlyWriteExempt('/api/exam/abc/submit')).toBe(true)
    expect(isReadonlyWriteExempt('/api/exam/abc/save-answer')).toBe(true)
    expect(isReadonlyWriteExempt('/api/exam/abc/videos/progress')).toBe(true)
    expect(isReadonlyWriteExempt('/api/exam/abc/scorm/tracking')).toBe(true)
    expect(isReadonlyWriteExempt('/api/auth/logout')).toBe(true)
  })

  it('alt-yollar (sonrası /) muaf kalmayı sürdürür', () => {
    expect(isReadonlyWriteExempt('/api/exam/abc/scorm/tracking/commit')).toBe(true)
    expect(isReadonlyWriteExempt('/api/exam/abc/submit?x=1')).toBe(true)
  })

  it('prefix-eşleşen SAHTE rotalar artık muaf DEĞİL (sabitleme)', () => {
    expect(isReadonlyWriteExempt('/api/exam/abc/submit-review')).toBe(false)
    expect(isReadonlyWriteExempt('/api/exam/abc/save-answer-bulk')).toBe(false)
    expect(isReadonlyWriteExempt('/api/exam/abc/state-admin')).toBe(false)
  })

  it('muaf olmayan yazma yolları reddedilir', () => {
    expect(isReadonlyWriteExempt('/api/admin/trainings')).toBe(false)
    expect(isReadonlyWriteExempt('/api/exam/abc/grade')).toBe(false)
  })
})
