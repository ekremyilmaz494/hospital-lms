/**
 * isOnPrem() dağıtım modu tespiti — on-prem lisans zorlaması ve build
 * davranışları bu bayrağa dayanır; yanlış pozitif/negatif ikisi de kritik.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

import { isOnPrem } from '@/lib/deployment'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isOnPrem', () => {
  it('hiçbir bayrak yokken false (bulut varsayılanı)', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    vi.stubEnv('DEPLOYMENT_MODE', '')
    expect(isOnPrem()).toBe(false)
  })

  it('NEXT_PUBLIC_DEPLOYMENT_MODE=onprem → true (build-time kanonik bayrak)', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'onprem')
    expect(isOnPrem()).toBe(true)
  })

  it('runtime DEPLOYMENT_MODE=onprem → true (lokal test kolaylığı)', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    expect(isOnPrem()).toBe(true)
  })

  it('başka değerler (cloud, boş, yazım hatası) → false', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', 'cloud')
    vi.stubEnv('DEPLOYMENT_MODE', 'on-prem')
    expect(isOnPrem()).toBe(false)
  })
})
