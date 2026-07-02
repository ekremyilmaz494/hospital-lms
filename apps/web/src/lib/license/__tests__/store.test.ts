/**
 * PlatformLicense store testleri — DB tamper (imza düşer → NO_LICENSE girdisi),
 * instanceId korunumu, makbuz eşleşme kontrolü, watermark ratchet eşiği.
 * Prisma mock'lanır; imza doğrulama GERÇEK (geçici test anahtarlarıyla).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'

const testKeys = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateKeyPairSync } = require('node:crypto') as typeof import('node:crypto')
  const issuer = generateKeyPairSync('ed25519')
  const receipt = generateKeyPairSync('ed25519')
  return {
    issuerPublicJwk: issuer.publicKey.export({ format: 'jwk' }),
    issuerPrivate: issuer.privateKey,
    receiptPublicJwk: receipt.publicKey.export({ format: 'jwk' }),
    receiptPrivate: receipt.privateKey,
  }
})

vi.mock('@/lib/license/keys', () => ({
  LICENSE_ISSUER: 'klinovax-license',
  RECEIPT_ISSUER: 'klinovax-receipt',
  LICENSE_ISSUER_PUBLIC_JWK: testKeys.issuerPublicJwk,
  RECEIPT_PUBLIC_JWK: testKeys.receiptPublicJwk,
}))

const prismaMock = vi.hoisted(() => ({
  platformLicense: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  loadLicenseSnapshot,
  activateLicense,
  storeReceipt,
  ratchetClockWatermark,
} from '@/lib/license/store'

const LICENSE_ID = '11111111-1111-4111-8111-111111111111'
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222'
const nowUnix = Math.floor(Date.now() / 1000)

async function signedLicense(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: 'klinovax-license',
    jti: LICENSE_ID,
    sub: 'test',
    iat: nowUnix,
    schemaVersion: 1,
    customerName: 'Test Hastanesi',
    licenseType: 'standard',
    validUntil: null,
    limits: { maxOrganizations: null, maxStaff: null },
    graceDays: 14,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(testKeys.issuerPrivate)
}

async function signedReceipt(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: 'klinovax-receipt',
    licenseId: LICENSE_ID,
    instanceId: INSTANCE_ID,
    status: 'valid',
    iat: nowUnix,
    exp: nowUnix + 35 * 86400,
    ...overrides,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(testKeys.receiptPrivate)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadLicenseSnapshot', () => {
  it('satır yoksa boş snapshot', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue(null)
    const snap = await loadLicenseSnapshot()
    expect(snap.claims).toBeNull()
    expect(snap.activatedAt).toBeNull()
  })

  it('geçerli JWT\'ler → claims + receipt dolu', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      id: 1,
      licenseJwt: await signedLicense(),
      licenseId: LICENSE_ID,
      instanceId: INSTANCE_ID,
      receiptJwt: await signedReceipt(),
      activatedAt: new Date(),
      clockWatermark: new Date(),
    })
    const snap = await loadLicenseSnapshot()
    expect(snap.claims?.jti).toBe(LICENSE_ID)
    expect(snap.receipt?.status).toBe('valid')
    expect(snap.signatureInvalid).toBe(false)
  })

  it('DB\'de lisans JWT\'si kurcalanmış → claims null + signatureInvalid', async () => {
    const jwt = await signedLicense()
    const [h, , s] = jwt.split('.')
    const forged = Buffer.from(JSON.stringify({ hacked: true })).toString('base64url')
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      id: 1,
      licenseJwt: `${h}.${forged}.${s}`,
      licenseId: LICENSE_ID,
      instanceId: INSTANCE_ID,
      receiptJwt: null,
      activatedAt: new Date(),
      clockWatermark: new Date(),
    })
    const snap = await loadLicenseSnapshot()
    expect(snap.claims).toBeNull()
    expect(snap.signatureInvalid).toBe(true)
  })

  it('bozuk makbuz lisansı öldürmez — makbuz null, claims sağlam', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      id: 1,
      licenseJwt: await signedLicense(),
      licenseId: LICENSE_ID,
      instanceId: INSTANCE_ID,
      receiptJwt: 'bozuk.makbuz.jwt',
      activatedAt: new Date(),
      clockWatermark: new Date(),
    })
    const snap = await loadLicenseSnapshot()
    expect(snap.claims?.jti).toBe(LICENSE_ID)
    expect(snap.receipt).toBeNull()
  })
})

describe('activateLicense', () => {
  it('ilk aktivasyon: yeni instanceId üretilir', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue(null)
    prismaMock.platformLicense.upsert.mockResolvedValue({})
    const claims = await activateLicense(await signedLicense())
    expect(claims.jti).toBe(LICENSE_ID)
    const args = prismaMock.platformLicense.upsert.mock.calls[0][0]
    expect(args.create.instanceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(args.create.licenseId).toBe(LICENSE_ID)
  })

  it('yenileme: eski makbuz temizlenir (grace çapası aktivasyondan yeniden başlar)', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      instanceId: INSTANCE_ID,
      clockWatermark: new Date(Date.now() - 1000),
    })
    prismaMock.platformLicense.upsert.mockResolvedValue({})
    await activateLicense(await signedLicense())
    const args = prismaMock.platformLicense.upsert.mock.calls[0][0]
    expect(args.update.receiptJwt).toBeNull()
    expect(args.update.lastHeartbeatAt).toBeNull()
  })

  it('watermark geriye sarılmaz: mevcut watermark ilerideyse korunur', async () => {
    const future = new Date(Date.now() + 3 * 86400_000)
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      instanceId: INSTANCE_ID,
      clockWatermark: future,
    })
    prismaMock.platformLicense.upsert.mockResolvedValue({})
    await activateLicense(await signedLicense())
    const args = prismaMock.platformLicense.upsert.mock.calls[0][0]
    expect(args.update.clockWatermark).toEqual(future)
  })

  it('imzasız/bozuk lisans aktive EDİLEMEZ', async () => {
    await expect(activateLicense('sahte.lisans.jwt')).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
    expect(prismaMock.platformLicense.upsert).not.toHaveBeenCalled()
  })
})

describe('storeReceipt', () => {
  it('eşleşen makbuz kaydedilir, watermark makbuz iat\'ine ratchet edilir', async () => {
    const past = new Date(Date.now() - 10 * 86400_000)
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      licenseId: LICENSE_ID,
      instanceId: INSTANCE_ID,
      clockWatermark: past,
    })
    prismaMock.platformLicense.update.mockResolvedValue({})
    const receipt = await storeReceipt(await signedReceipt())
    expect(receipt.status).toBe('valid')
    const args = prismaMock.platformLicense.update.mock.calls[0][0]
    expect(args.data.clockWatermark.getTime()).toBeGreaterThan(past.getTime())
  })

  it('başka lisansın makbuzu REDDEDİLİR', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      licenseId: '99999999-9999-4999-8999-999999999999',
      instanceId: INSTANCE_ID,
      clockWatermark: new Date(),
    })
    await expect(storeReceipt(await signedReceipt())).rejects.toThrow(
      'Makbuz bu kurulumun lisansına ait değil',
    )
  })

  it('başka instance\'ın makbuzu REDDEDİLİR', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      licenseId: LICENSE_ID,
      instanceId: '99999999-9999-4999-8999-999999999999',
      clockWatermark: new Date(),
    })
    await expect(storeReceipt(await signedReceipt())).rejects.toThrow()
  })
})

describe('ratchetClockWatermark', () => {
  it('1 saatten küçük ilerleme yazılmaz (write amplification koruması)', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      clockWatermark: new Date(Date.now() - 30 * 60 * 1000),
    })
    await ratchetClockWatermark()
    expect(prismaMock.platformLicense.update).not.toHaveBeenCalled()
  })

  it('1 saatten büyük ilerleme watermark\'ı günceller', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue({
      clockWatermark: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })
    prismaMock.platformLicense.update.mockResolvedValue({})
    await ratchetClockWatermark()
    expect(prismaMock.platformLicense.update).toHaveBeenCalled()
  })

  it('satır yoksa sessizce çıkar', async () => {
    prismaMock.platformLicense.findUnique.mockResolvedValue(null)
    await expect(ratchetClockWatermark()).resolves.toBeUndefined()
  })
})
