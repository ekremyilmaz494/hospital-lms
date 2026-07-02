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

/** Lisans JWT'sini doğrulayan public JWK (Ed25519). */
export const LICENSE_ISSUER_PUBLIC_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'ozAdQbOx4PHWDV_QxBrLU41SbHbuquKJQTgbiFoibTo',
} as const

/** Doğrulama makbuzunu (heartbeat yanıtı) doğrulayan public JWK (Ed25519). */
export const RECEIPT_PUBLIC_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'asru1wTYfAN7zs_Rd0uAFrIm0rxTmWJKBjZXEWBgh48',
} as const
