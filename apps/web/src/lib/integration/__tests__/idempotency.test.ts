import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Idempotency deposu — org + scope (pathname) izolasyonu.
 *
 * Kritik güvence (hakem S2 düzeltmesi): aynı Idempotency-Key FARKLI bir write
 * ucunda (scope) kullanılırsa yanlış ucun yanıtını replay ETMEMELİ. Redis
 * yapılandırılmamış → modül in-memory fallback'i kullanır (dev deseni).
 */

vi.mock('@/lib/redis', () => ({ getRedis: () => null }))

import {
  idempotencyBegin,
  idempotencyComplete,
  idempotencyRelease,
} from '../idempotency'

const ORG = 'org-1'
const KEY = 'nightly-2026-07-03'
const SCOPE_A = '/api/integration/v1/staff'
const SCOPE_B = '/api/integration/v1/sync'

beforeEach(() => {
  // Modül-lokal memory map'i temizlemek için: aynı testte kullanılan anahtarları serbest bırak.
  return Promise.all([
    idempotencyRelease(ORG, KEY, SCOPE_A),
    idempotencyRelease(ORG, KEY, SCOPE_B),
  ])
})

describe('idempotency — org + scope izolasyonu', () => {
  it('ilk çağrı acquired, aynı (org,key,scope) tekrarı pending', async () => {
    expect(await idempotencyBegin(ORG, KEY, SCOPE_A)).toEqual({ state: 'acquired' })
    expect(await idempotencyBegin(ORG, KEY, SCOPE_A)).toEqual({ state: 'pending' })
  })

  it('tamamlanınca aynı scope replay, FARKLI scope acquired (uç izolasyonu)', async () => {
    await idempotencyBegin(ORG, KEY, SCOPE_A)
    await idempotencyComplete(ORG, KEY, SCOPE_A, 201, JSON.stringify({ ok: true, endpoint: 'staff' }))

    // Aynı uç → replay
    const replay = await idempotencyBegin(ORG, KEY, SCOPE_A)
    expect(replay).toEqual({ state: 'replay', status: 201, body: JSON.stringify({ ok: true, endpoint: 'staff' }) })

    // FARKLI uç, aynı key → yanlış yanıtı replay ETMEZ, temiz kilit alır
    const other = await idempotencyBegin(ORG, KEY, SCOPE_B)
    expect(other).toEqual({ state: 'acquired' })
  })

  it('farklı org aynı key/scope → izole', async () => {
    await idempotencyBegin(ORG, KEY, SCOPE_A)
    const otherOrg = await idempotencyBegin('org-2', KEY, SCOPE_A)
    expect(otherOrg).toEqual({ state: 'acquired' })
    await idempotencyRelease('org-2', KEY, SCOPE_A)
  })

  it('release sonrası tekrar acquired alınabilir (retry senaryosu)', async () => {
    await idempotencyBegin(ORG, KEY, SCOPE_A)
    await idempotencyRelease(ORG, KEY, SCOPE_A)
    expect(await idempotencyBegin(ORG, KEY, SCOPE_A)).toEqual({ state: 'acquired' })
  })
})
