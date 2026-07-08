/**
 * Lisans sunucusu public uçları (activate + heartbeat) — imza-kimlik modeli,
 * kayıt zorunluluğu, iptal makbuzu, dosyasız yenileme, çoklu-instance anomalisi.
 * Kripto GERÇEK (geçici test anahtarları); prisma/redis mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import type { NextRequest } from 'next/server'

const testKeys = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateKeyPairSync } = require('node:crypto') as typeof import('node:crypto')
  const issuer = generateKeyPairSync('ed25519')
  const receipt = generateKeyPairSync('ed25519')
  return {
    issuerPublicJwk: issuer.publicKey.export({ format: 'jwk' }),
    issuerPrivate: issuer.privateKey,
    receiptPublicJwk: receipt.publicKey.export({ format: 'jwk' }),
    receiptPrivateJwkB64: Buffer.from(
      JSON.stringify(receipt.privateKey.export({ format: 'jwk' })),
    ).toString('base64'),
  }
})

vi.mock('@/lib/license/keys', () => ({
  LICENSE_ISSUER: 'klinovax-license',
  RECEIPT_ISSUER: 'klinovax-receipt',
  LICENSE_ISSUER_PUBLIC_JWK: testKeys.issuerPublicJwk,
  RECEIPT_PUBLIC_JWK: testKeys.receiptPublicJwk,
}))

const prismaMock = vi.hoisted(() => ({
  license: { findUnique: vi.fn() },
  licenseActivation: { upsert: vi.fn(), findMany: vi.fn() },
  licenseHeartbeat: { create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const auditMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-helpers')>()),
  createAuditLog: auditMock,
}))

import { POST as activatePost } from '@/app/api/public/license/activate/route'
import { POST as heartbeatPost } from '@/app/api/public/license/heartbeat/route'
import { verifyReceiptJwt } from '@/lib/license/verify'

const LICENSE_ID = '11111111-1111-4111-8111-111111111111'
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_INSTANCE = '33333333-3333-4333-8333-333333333333'
const nowUnix = Math.floor(Date.now() / 1000)

async function signLicense(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: 'klinovax-license',
    jti: LICENSE_ID,
    sub: 'test',
    iat: nowUnix,
    schemaVersion: 1,
    customerName: 'Test Hastanesi',
    licenseType: 'standard',
    validUntil: null,
    limits: { maxOrganizations: 1, maxStaff: 500 },
    graceDays: 14,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(testKeys.issuerPrivate)
}

function post(body: unknown): NextRequest {
  return new Request('http://test.local/api/public/license/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function licenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LICENSE_ID,
    customerName: 'Test Hastanesi',
    licenseJwt: 'kayitli-jwt-ayni-olmayabilir',
    status: 'active',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('LICENSE_RECEIPT_PRIVATE_KEY', testKeys.receiptPrivateJwkB64)
  vi.stubEnv('DEPLOYMENT_MODE', '')
  vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_MODE', '')
  prismaMock.licenseActivation.upsert.mockResolvedValue({})
  prismaMock.licenseActivation.findMany.mockResolvedValue([{ instanceId: INSTANCE_ID }])
  prismaMock.licenseHeartbeat.create.mockResolvedValue({})
})

describe('POST /api/public/license/activate', () => {
  it('kayıtlı lisans + geçerli imza → doğrulanabilir makbuz döner', async () => {
    prismaMock.license.findUnique.mockResolvedValue(licenseRow())
    const res = await activatePost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID, appVersion: '1.0.0' }),
    )
    expect(res.status).toBe(200)
    const { receipt } = (await res.json()) as { receipt: string }
    const claims = await verifyReceiptJwt(receipt)
    expect(claims.licenseId).toBe(LICENSE_ID)
    expect(claims.instanceId).toBe(INSTANCE_ID)
    expect(claims.status).toBe('valid')
    expect(prismaMock.licenseActivation.upsert).toHaveBeenCalled()
  })

  it('kayıtsız lisans → 404 (kayıt kontrol noktasıdır)', async () => {
    prismaMock.license.findUnique.mockResolvedValue(null)
    const res = await activatePost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID }),
    )
    expect(res.status).toBe(404)
  })

  it('geçersiz imzalı JWT → 403', async () => {
    const res = await activatePost(
      post({ licenseJwt: 'sahte-header-uzun.sahte-payload-uzun.sahte-imza-uzun', instanceId: INSTANCE_ID }),
    )
    expect(res.status).toBe(403)
    expect(prismaMock.license.findUnique).not.toHaveBeenCalled()
  })

  it('geçersiz gövde (instanceId UUID değil) → 400', async () => {
    const res = await activatePost(
      post({ licenseJwt: await signLicense(), instanceId: 'uuid-degil' }),
    )
    expect(res.status).toBe(400)
  })

  it('iptal edilmiş lisans → revoked makbuz (kurulum kilitlenir)', async () => {
    prismaMock.license.findUnique.mockResolvedValue(licenseRow({ status: 'revoked' }))
    const res = await activatePost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID }),
    )
    const { receipt } = (await res.json()) as { receipt: string }
    expect((await verifyReceiptJwt(receipt)).status).toBe('revoked')
  })

  it('on-prem modda uç kapalı → 404', async () => {
    vi.stubEnv('DEPLOYMENT_MODE', 'onprem')
    const res = await activatePost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID }),
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/public/license/heartbeat', () => {
  const usage = { orgCount: 1, staffCount: 42, appVersion: '1.0.0' }

  it('geçerli heartbeat → taze makbuz + telemetri kaydı', async () => {
    prismaMock.license.findUnique.mockResolvedValue(licenseRow())
    const res = await heartbeatPost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID, usage }),
    )
    expect(res.status).toBe(200)
    const { receipt } = (await res.json()) as { receipt: string }
    expect((await verifyReceiptJwt(receipt)).status).toBe('valid')
    expect(prismaMock.licenseHeartbeat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgCount: 1, staffCount: 42 }),
    })
  })

  it('iptal edilen lisans heartbeat\'te revoked makbuz alır', async () => {
    prismaMock.license.findUnique.mockResolvedValue(licenseRow({ status: 'revoked' }))
    const res = await heartbeatPost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID, usage }),
    )
    const { receipt } = (await res.json()) as { receipt: string }
    expect((await verifyReceiptJwt(receipt)).status).toBe('revoked')
  })

  it('24 saatte >1 instance → çoklu-instance anomalisi audit\'e yazılır', async () => {
    prismaMock.license.findUnique.mockResolvedValue(licenseRow())
    prismaMock.licenseActivation.findMany.mockResolvedValue([
      { instanceId: INSTANCE_ID },
      { instanceId: OTHER_INSTANCE },
    ])
    await heartbeatPost(
      post({ licenseJwt: await signLicense(), instanceId: INSTANCE_ID, usage }),
    )
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'license.anomaly.multi_instance' }),
    )
  })

  it('kayıtlı JWT sunulandan YENİyse renewedLicense makbuzla iletilir (dosyasız yenileme)', async () => {
    const oldJwt = await signLicense({ iat: nowUnix - 1000 })
    const newJwt = await signLicense({ iat: nowUnix })
    prismaMock.license.findUnique.mockResolvedValue(licenseRow({ licenseJwt: newJwt }))
    const res = await heartbeatPost(
      post({ licenseJwt: oldJwt, instanceId: INSTANCE_ID, usage }),
    )
    const { receipt } = (await res.json()) as { receipt: string }
    expect((await verifyReceiptJwt(receipt)).renewedLicense).toBe(newJwt)
  })

  it('kayıtlı JWT sunulanla AYNI ise renewedLicense null', async () => {
    const jwt = await signLicense()
    prismaMock.license.findUnique.mockResolvedValue(licenseRow({ licenseJwt: jwt }))
    const res = await heartbeatPost(post({ licenseJwt: jwt, instanceId: INSTANCE_ID, usage }))
    const { receipt } = (await res.json()) as { receipt: string }
    expect((await verifyReceiptJwt(receipt)).renewedLicense).toBeNull()
  })

  it('geçersiz imza → 403, telemetri yazılmaz', async () => {
    const res = await heartbeatPost(
      post({ licenseJwt: 'sahte-header-uzun.sahte-payload-uzun.sahte-imza-uzun', instanceId: INSTANCE_ID, usage }),
    )
    expect(res.status).toBe(403)
    expect(prismaMock.licenseHeartbeat.create).not.toHaveBeenCalled()
  })
})
