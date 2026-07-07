import { compactVerify, importJWK } from 'jose'
import type { JWK } from 'jose'
import { isOnPrem } from '@/lib/deployment'
import {
  LICENSE_ISSUER_PUBLIC_JWK,
  RECEIPT_PUBLIC_JWK,
  usingDevLicenseKeys,
} from '@/lib/license/keys'
import {
  licenseClaimsSchema,
  receiptClaimsSchema,
  SUPPORTED_LICENSE_SCHEMA_VERSION,
  type LicenseClaims,
  type ReceiptClaims,
} from '@/lib/license/schema'

/**
 * Lisans/makbuz JWT imza doğrulaması — FAIL-CLOSED.
 *
 * `compactVerify` bilinçli tercih: `jwtVerify` exp'li token'ı otomatik reddeder,
 * oysa SÜRESİ GEÇMİŞ makbuz bizim için hâlâ anlamlıdır (offline grace hesabı
 * makbuz yaşına dayanır). exp/validUntil semantiği durum makinesinde
 * (`state.ts`) işlenir; burada YALNIZ imza + biçim + issuer doğrulanır.
 * Algoritma allowlist'i (yalnız EdDSA) alg-confusion saldırısını kapatır.
 */

export type LicenseVerifyReason =
  | 'signature_invalid'
  | 'claims_invalid'
  | 'schema_unsupported'
  | 'dev_keys_in_production'

export class LicenseVerifyError extends Error {
  constructor(
    message: string,
    public readonly reason: LicenseVerifyReason,
  ) {
    super(message)
    this.name = 'LicenseVerifyError'
  }
}

async function verifySignedPayload(jwt: string, publicJwk: JWK): Promise<unknown> {
  let payloadBytes: Uint8Array
  try {
    const key = await importJWK(publicJwk, 'EdDSA')
    const result = await compactVerify(jwt, key, { algorithms: ['EdDSA'] })
    payloadBytes = result.payload
  } catch {
    throw new LicenseVerifyError('İmza doğrulanamadı', 'signature_invalid')
  }
  try {
    return JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown
  } catch {
    throw new LicenseVerifyError('Payload JSON değil', 'claims_invalid')
  }
}

/**
 * Lisans JWT'sini (license.klv içeriği) doğrular.
 * @throws LicenseVerifyError — imza/biçim hatası veya desteklenmeyen şema sürümü.
 */
export async function verifyLicenseJwt(jwt: string): Promise<LicenseClaims> {
  // FORGEABLE ÇIPA GUARD'I (fail-closed): üretim on-prem paketi anahtar töreni
  // yapılmadan (keys.ts DEV placeholder) çıkarsa dev private anahtarını bilen taraf
  // lisans forge edebilir. Bu durumda doğrulamayı reddet → durum makinesi kilitlenir.
  // CI/dev için kaçış: ALLOW_DEV_LICENSE_KEYS=true. Bulut modda no-op (isOnPrem false).
  if (
    isOnPrem() &&
    process.env.NODE_ENV === 'production' &&
    usingDevLicenseKeys() &&
    process.env.ALLOW_DEV_LICENSE_KEYS !== 'true'
  ) {
    throw new LicenseVerifyError(
      'Sistem lisans anahtarları üretim için yapılandırılmamış. Lütfen tedarikçiyle iletişime geçin.',
      'dev_keys_in_production',
    )
  }

  const payload = await verifySignedPayload(jwt, LICENSE_ISSUER_PUBLIC_JWK as JWK)

  // Şema sürümü önce kontrol edilir ki gelecekteki lisanslar için kullanıcıya
  // "biçim bozuk" değil "uygulamayı güncelleyin" mesajı verilebilsin.
  const version = (payload as { schemaVersion?: unknown })?.schemaVersion
  if (typeof version === 'number' && version > SUPPORTED_LICENSE_SCHEMA_VERSION) {
    throw new LicenseVerifyError(
      `Lisans şema sürümü ${version} bu uygulama sürümünce desteklenmiyor — lütfen uygulamayı güncelleyin.`,
      'schema_unsupported',
    )
  }

  const parsed = licenseClaimsSchema.safeParse(payload)
  if (!parsed.success) {
    throw new LicenseVerifyError('Lisans içeriği geçersiz', 'claims_invalid')
  }
  return parsed.data
}

/**
 * Doğrulama makbuzunu (heartbeat yanıtı / offline makbuz dosyası) doğrular.
 * Süresi geçmiş makbuz REDDEDİLMEZ — yaşı durum makinesinde değerlendirilir.
 * @throws LicenseVerifyError
 */
export async function verifyReceiptJwt(jwt: string): Promise<ReceiptClaims> {
  const payload = await verifySignedPayload(jwt, RECEIPT_PUBLIC_JWK as JWK)
  const parsed = receiptClaimsSchema.safeParse(payload)
  if (!parsed.success) {
    throw new LicenseVerifyError('Makbuz içeriği geçersiz', 'claims_invalid')
  }
  return parsed.data
}
