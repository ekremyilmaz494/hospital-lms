/**
 * Lisans zorlama kapıları (enforcement.ts) — karar tablosu × rota sınıfı.
 * getLicenseState mock'lanır (durum makinesi ayrı test edildi); burada
 * KAPI mantığı sınanır: hangi durum hangi yolu bloklar/geçirir.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getLicenseStateMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/license/cache', () => ({ getLicenseState: getLicenseStateMock }))

import {
  licenseApiGate,
  isReadonlyWriteExempt,
  isBusinessCronAllowed,
  shouldRedirectToLicense,
} from '@/lib/license/enforcement'

function stub(state: string) {
  getLicenseStateMock.mockResolvedValue({ state, reasons: [], daysToExpiry: 10 })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
  vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('licenseApiGate — bulut modunda daima geçir', () => {
  it('bulut → blocked=false, getLicenseState çağrılmaz', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    const d = await licenseApiGate('/api/admin/trainings')
    expect(d.blocked).toBe(false)
    expect(getLicenseStateMock).not.toHaveBeenCalled()
  })
})

describe('licenseApiGate — LOCKED/NO_LICENSE herkese 403', () => {
  it('LOCKED → iş rotası bloklanır', async () => {
    stub('LOCKED')
    const d = await licenseApiGate('/api/admin/trainings')
    expect(d.blocked).toBe(true)
    expect(d.code).toBe('license_locked')
  })

  it('NO_LICENSE → iş rotası bloklanır (kod ayrı)', async () => {
    stub('NO_LICENSE')
    const d = await licenseApiGate('/api/staff/dashboard')
    expect(d.blocked).toBe(true)
    expect(d.code).toBe('license_no_license')
  })

  it('LOCKED olsa bile lisans/health/oturum yolları AÇIK', async () => {
    stub('LOCKED')
    for (const p of [
      '/api/license/status',
      '/api/license/activate',
      '/api/health',
      '/api/auth/logout',
      '/api/public/license/activate',
      '/api/cron/license-heartbeat',
    ]) {
      expect((await licenseApiGate(p)).blocked).toBe(false)
    }
  })
})

describe('licenseApiGate — VALID/WARN/READONLY geçir (yazma bloğu ayrı katman)', () => {
  it.each(['VALID', 'WARN', 'READONLY'])('%s → API kapısından geçer', async (state) => {
    stub(state)
    expect((await licenseApiGate('/api/admin/trainings')).blocked).toBe(false)
  })
})

describe('isReadonlyWriteExempt — aktif sınav ilerlemesi + oturum muaf', () => {
  it.each([
    '/api/exam/abc/save-answer',
    '/api/exam/abc/timer',
    '/api/exam/abc/videos/progress',
    '/api/exam/abc/submit',
    '/api/exam/abc/sign',
    '/api/exam/abc/scorm/tracking',
    '/api/auth/logout',
    '/api/auth/change-password',
  ])('%s → muaf', (p) => {
    expect(isReadonlyWriteExempt(p)).toBe(true)
  })

  it.each([
    '/api/admin/trainings',
    '/api/admin/staff',
    '/api/exam/abc/questions',
    '/api/staff/profile',
  ])('%s → muaf DEĞİL (READONLY bloklanır)', (p) => {
    expect(isReadonlyWriteExempt(p)).toBe(false)
  })
})

describe('isBusinessCronAllowed', () => {
  it.each(['VALID', 'WARN'])('%s → iş cron\'ları çalışır', async (state) => {
    stub(state)
    expect(await isBusinessCronAllowed()).toBe(true)
  })
  it.each(['READONLY', 'LOCKED', 'NO_LICENSE'])('%s → iş cron\'ları atlanır', async (state) => {
    stub(state)
    expect(await isBusinessCronAllowed()).toBe(false)
  })
  it('bulut → daima çalışır', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    expect(await isBusinessCronAllowed()).toBe(true)
  })
})

describe('shouldRedirectToLicense — sayfa guard', () => {
  it.each(['LOCKED', 'NO_LICENSE'])('%s → /license\'a yönlendir', async (state) => {
    stub(state)
    expect(await shouldRedirectToLicense()).toBe(true)
  })
  it.each(['VALID', 'WARN', 'READONLY'])('%s → yönlendirme yok', async (state) => {
    stub(state)
    expect(await shouldRedirectToLicense()).toBe(false)
  })
  it('bulut → asla yönlendirme', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', '')
    expect(await shouldRedirectToLicense()).toBe(false)
  })
})
