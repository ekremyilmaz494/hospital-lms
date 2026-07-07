/**
 * Klinovax lisans sistemi — gömülü Ed25519 PUBLIC anahtarları.
 *
 * Bu anahtarlar KAYNAK KODA GÖMÜLÜDÜR, env'den OKUNMAZ: env üzerinden anahtar
 * değiştirmek müşteri tarafında önemsiz olurdu; gömülü sabit ancak yeniden
 * derlemeyle değişir (on-prem müşterisi kaynak koda sahip değildir).
 *
 * İki ayrı anahtar çifti:
 * - İHRAÇ (issuer): lisans dosyasını (license.klv JWT) imzalar. Private key
 *   HİÇBİR sunucuda durmaz — offline CLI'da (tools/license-cli, soğuk saklama).
 * - MAKBUZ (receipt): SaaS lisans sunucusunun heartbeat yanıtlarını imzalar.
 *   Private key SaaS env'inde (LICENSE_RECEIPT_PRIVATE_KEY). Ayrım sayesinde
 *   SaaS tamamen ele geçse bile saldırgan en fazla ~35 günlük makbuz basabilir,
 *   asla yeni lisans üretemez.
 *
 * ⚠️ AŞAĞIDAKİLER DEV/TEST ANAHTARLARIDIR (Faz 5 anahtar töreninde üretim
 * public anahtarlarıyla DEĞİŞTİRİLECEK). Test private key'leri yalnız
 * __tests__/ fixture'larında ve lokal CLI denemelerinde kullanılır.
 */

export const LICENSE_ISSUER = 'klinovax-license'
export const RECEIPT_ISSUER = 'klinovax-receipt'

/** Gömülü (kaynak koda sabit) DEV/TEST issuer public `x`. */
const EMBEDDED_ISSUER_X = 'ozAdQbOx4PHWDV_QxBrLU41SbHbuquKJQTgbiFoibTo'

/**
 * Issuer public `x` çözümü. NORMALDE gömülü sabit döner (env'den OKUNMAZ — güvenlik
 * modeli bu). TEK istisna: lokal/CI test için `ALLOW_DEV_LICENSE_KEYS=true` iken
 * `LICENSE_ISSUER_PUBLIC_JWK_X` env'i verilmişse onu kullanır (test-imzalı lisansı
 * doğrulayabilmek için). Gerçek üretim/müşteri kurulumunda ALLOW_DEV_LICENSE_KEYS
 * set EDİLMEZ → gömülü sabit korunur, hiçbir müşteri env ile anahtar değiştiremez.
 */
function resolveIssuerPublicX(): string {
  if (
    process.env.ALLOW_DEV_LICENSE_KEYS === 'true' &&
    process.env.LICENSE_ISSUER_PUBLIC_JWK_X
  ) {
    return process.env.LICENSE_ISSUER_PUBLIC_JWK_X
  }
  return EMBEDDED_ISSUER_X
}

/** Lisans JWT'sini doğrulayan public JWK (Ed25519). */
export const LICENSE_ISSUER_PUBLIC_JWK = {
  kty: 'OKP' as const,
  crv: 'Ed25519' as const,
  x: resolveIssuerPublicX(),
}

/** Doğrulama makbuzunu (heartbeat yanıtı) doğrulayan public JWK (Ed25519). */
export const RECEIPT_PUBLIC_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'asru1wTYfAN7zs_Rd0uAFrIm0rxTmWJKBjZXEWBgh48',
} as const

/**
 * Bilinen DEV/TEST anahtar parmak izleri. Anahtar töreninde YUKARIDAKİ JWK `x`
 * değerleri üretim anahtarlarıyla değişir; AŞAĞIDAKİ sabitleri DEĞİŞTİRME —
 * bunlar "forgeable dev çıpası" tespiti için sabit referanstır.
 */
const DEV_ISSUER_X = 'ozAdQbOx4PHWDV_QxBrLU41SbHbuquKJQTgbiFoibTo'
const DEV_RECEIPT_X = 'asru1wTYfAN7zs_Rd0uAFrIm0rxTmWJKBjZXEWBgh48'

/**
 * Gömülü lisans anahtarları hâlâ DEV/TEST placeholder mı? true ise üretim anahtar
 * töreni yapılmamıştır — üretim on-prem paketi bu haldeyken FORGEABLE'dır
 * (dev private anahtarı bilen taraf kabul edilen lisans üretebilir). Zorlama:
 * verify.ts üretim+on-prem'de bu durumda doğrulamayı reddeder (fail-closed).
 */
export function usingDevLicenseKeys(): boolean {
  return (
    LICENSE_ISSUER_PUBLIC_JWK.x === DEV_ISSUER_X ||
    RECEIPT_PUBLIC_JWK.x === DEV_RECEIPT_X
  )
}
