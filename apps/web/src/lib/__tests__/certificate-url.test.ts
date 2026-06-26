import { describe, it, expect, vi, afterEach } from 'vitest'

// certificate-url → api-helpers (getAppUrl) zinciri prisma/supabase import eder;
// modül yükleme yan etkilerini engellemek için mock'la (getAppUrl yalnız env okur).
vi.mock('../supabase/server', () => ({ createClient: vi.fn(), createBearerClient: vi.fn() }))
vi.mock('../prisma', () => ({ prisma: {} }))

import { certificateVerifyUrl } from '../certificate-url'

describe('certificateVerifyUrl', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original
  })

  it('apex (org subdomain DEĞİL) tabanlı doğrulama URL üretir', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://klinovax.com'
    expect(certificateVerifyUrl('CERT-ABC123')).toBe(
      'https://klinovax.com/certificates/verify/CERT-ABC123',
    )
  })

  it('NEXT_PUBLIC_APP_URL yoksa localhost fallback (dev)', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(certificateVerifyUrl('CERT-XYZ')).toBe(
      'http://localhost:3000/certificates/verify/CERT-XYZ',
    )
  })
})
