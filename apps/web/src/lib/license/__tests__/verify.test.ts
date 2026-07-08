/**
 * Lisans/makbuz imza doğrulama testleri — her test koşusunda üretilen geçici
 * Ed25519 çiftleriyle (keys modülü mock'lanır; üretim public anahtarları test
 * private key'ine BAĞIMLI DEĞİLDİR — Faz 5 anahtar değişiminde testler bozulmaz).
 */
import { describe, it, expect, vi } from 'vitest'
import { SignJWT } from 'jose'
import type { KeyObject } from 'node:crypto'

const testKeys = vi.hoisted(() => {
  // vi.mock factory hoisted çalışır — anahtarlar da hoisted üretilmeli (sync).
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

import { verifyLicenseJwt, verifyReceiptJwt, LicenseVerifyError } from '@/lib/license/verify'

const LICENSE_ID = '11111111-1111-4111-8111-111111111111'
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222'
const nowUnix = Math.floor(Date.now() / 1000)

function licensePayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'klinovax-license',
    jti: LICENSE_ID,
    sub: 'test-hastanesi',
    iat: nowUnix,
    schemaVersion: 1,
    customerName: 'Test Hastanesi',
    licenseType: 'standard',
    validUntil: new Date(Date.now() + 365 * 86400_000).toISOString(),
    limits: { maxOrganizations: 3, maxStaff: 500 },
    graceDays: 14,
    ...overrides,
  }
}

function receiptPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'klinovax-receipt',
    licenseId: LICENSE_ID,
    instanceId: INSTANCE_ID,
    status: 'valid',
    iat: nowUnix,
    exp: nowUnix + 35 * 86400,
    ...overrides,
  }
}

async function sign(payload: Record<string, unknown>, key: KeyObject): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'EdDSA' }).sign(key)
}

describe('verifyLicenseJwt', () => {
  it('geçerli imzalı lisans → claim roundtrip', async () => {
    const jwt = await sign(licensePayload(), testKeys.issuerPrivate)
    const claims = await verifyLicenseJwt(jwt)
    expect(claims.jti).toBe(LICENSE_ID)
    expect(claims.customerName).toBe('Test Hastanesi')
    expect(claims.limits.maxStaff).toBe(500)
  })

  it('payload tamper → signature_invalid', async () => {
    const jwt = await sign(licensePayload(), testKeys.issuerPrivate)
    const [h, , s] = jwt.split('.')
    const forged = Buffer.from(
      JSON.stringify(licensePayload({ limits: { maxOrganizations: null, maxStaff: null } })),
    ).toString('base64url')
    await expect(verifyLicenseJwt(`${h}.${forged}.${s}`)).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })

  it('yanlış anahtarla imza → signature_invalid', async () => {
    const jwt = await sign(licensePayload(), testKeys.receiptPrivate)
    await expect(verifyLicenseJwt(jwt)).rejects.toMatchObject({ reason: 'signature_invalid' })
  })

  it('HS256 alg-confusion denemesi → signature_invalid (EdDSA allowlist)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify(licensePayload())).toString('base64url')
    const fakeSig = Buffer.from('deadbeef').toString('base64url')
    await expect(verifyLicenseJwt(`${header}.${body}.${fakeSig}`)).rejects.toMatchObject({
      reason: 'signature_invalid',
    })
  })

  it('gelecek şema sürümü → schema_unsupported ("uygulamayı güncelleyin")', async () => {
    const jwt = await sign(licensePayload({ schemaVersion: 2 }), testKeys.issuerPrivate)
    await expect(verifyLicenseJwt(jwt)).rejects.toMatchObject({ reason: 'schema_unsupported' })
  })

  it('eksik claim (customerName yok) → claims_invalid', async () => {
    const payload = licensePayload()
    delete (payload as Record<string, unknown>).customerName
    const jwt = await sign(payload, testKeys.issuerPrivate)
    await expect(verifyLicenseJwt(jwt)).rejects.toMatchObject({ reason: 'claims_invalid' })
  })

  it('yanlış issuer → claims_invalid', async () => {
    const jwt = await sign(licensePayload({ iss: 'sahte-issuer' }), testKeys.issuerPrivate)
    await expect(verifyLicenseJwt(jwt)).rejects.toBeInstanceOf(LicenseVerifyError)
  })
})

describe('verifyReceiptJwt', () => {
  it('geçerli makbuz → roundtrip', async () => {
    const jwt = await sign(receiptPayload(), testKeys.receiptPrivate)
    const receipt = await verifyReceiptJwt(jwt)
    expect(receipt.licenseId).toBe(LICENSE_ID)
    expect(receipt.status).toBe('valid')
  })

  it('SÜRESİ GEÇMİŞ makbuz yine doğrulanır (grace hesabı yaşa dayanır)', async () => {
    const jwt = await sign(
      receiptPayload({ iat: nowUnix - 40 * 86400, exp: nowUnix - 5 * 86400 }),
      testKeys.receiptPrivate,
    )
    const receipt = await verifyReceiptJwt(jwt)
    expect(receipt.iat).toBe(nowUnix - 40 * 86400)
  })

  it('makbuz İHRAÇ anahtarıyla imzalanamaz (anahtar ayrımı)', async () => {
    const jwt = await sign(receiptPayload(), testKeys.issuerPrivate)
    await expect(verifyReceiptJwt(jwt)).rejects.toMatchObject({ reason: 'signature_invalid' })
  })

  it('revoked makbuz claim olarak geçerli döner', async () => {
    const jwt = await sign(receiptPayload({ status: 'revoked' }), testKeys.receiptPrivate)
    const receipt = await verifyReceiptJwt(jwt)
    expect(receipt.status).toBe('revoked')
  })
})
