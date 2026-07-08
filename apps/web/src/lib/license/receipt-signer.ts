import { SignJWT, importJWK } from 'jose'
import type { CryptoKey as JoseKey } from 'jose'
import { RECEIPT_ISSUER } from '@/lib/license/keys'

/**
 * Doğrulama makbuzu imzalayıcı — YALNIZ SaaS (lisans sunucusu) tarafında çalışır.
 *
 * Private key env'den okunur: LICENSE_RECEIPT_PRIVATE_KEY = base64(JWK JSON).
 * On-prem kurulumlara bu env HİÇ verilmez — makbuz üretemezler. İhraç (lisans
 * imzalama) anahtarından ayrıdır: SaaS ele geçse bile saldırgan en fazla
 * RECEIPT_VALIDITY_DAYS'lik makbuz basabilir, yeni lisans üretemez.
 */

/** Makbuz geçerlilik penceresi — heartbeat 6 saatte bir; 35 gün bolca tampon. */
export const RECEIPT_VALIDITY_DAYS = 35

let cachedKey: JoseKey | Uint8Array | null = null

async function getReceiptPrivateKey(): Promise<JoseKey | Uint8Array> {
  if (cachedKey) return cachedKey
  const raw = process.env.LICENSE_RECEIPT_PRIVATE_KEY
  if (!raw) {
    throw new Error('LICENSE_RECEIPT_PRIVATE_KEY env var eksik (lisans sunucusu değil mi?)')
  }
  let jwk: Record<string, unknown>
  try {
    jwk = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    throw new Error('LICENSE_RECEIPT_PRIVATE_KEY base64(JWK JSON) biçiminde olmalı')
  }
  const key = await importJWK(jwk as Parameters<typeof importJWK>[0], 'EdDSA')
  cachedKey = key as JoseKey | Uint8Array
  return cachedKey
}

export interface ReceiptSignParams {
  licenseId: string
  instanceId: string
  status: 'valid' | 'revoked'
  /** Kayıtlı JWT sunulandan yeniyse buradan iletilir (dosyasız yenileme). */
  renewedLicense?: string | null
}

/** İmzalı doğrulama makbuzu (JWT) üretir. iat = sunucu saati (watermark kaynağı). */
export async function signReceipt(params: ReceiptSignParams): Promise<string> {
  const key = await getReceiptPrivateKey()
  const nowUnix = Math.floor(Date.now() / 1000)
  return new SignJWT({
    iss: RECEIPT_ISSUER,
    licenseId: params.licenseId,
    instanceId: params.instanceId,
    status: params.status,
    iat: nowUnix,
    exp: nowUnix + RECEIPT_VALIDITY_DAYS * 86400,
    renewedLicense: params.renewedLicense ?? null,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .sign(key)
}
