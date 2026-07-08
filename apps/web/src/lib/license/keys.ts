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
 * ✅ ÜRETİM anahtar töreni YAPILDI (2026-07-08): gömülü issuer/receipt public
 * anahtarları üretim değerleridir. Private'ler bu repo'da/sunucuda DEĞİL — issuer
 * private soğuk saklamada (offline), receipt private SaaS env'inde
 * (LICENSE_RECEIPT_PRIVATE_KEY). Aşağıdaki DEV_* sabitleri yalnızca "dev-anahtar
 * kullanılıyor mu" tespiti için referanstır (usingDevLicenseKeys) — DEĞİŞTİRME.
 */

export const LICENSE_ISSUER = 'klinovax-license'
export const RECEIPT_ISSUER = 'klinovax-receipt'

/** Gömülü (kaynak koda sabit) ÜRETİM issuer public `x` (anahtar töreni 2026-07-08). */
const EMBEDDED_ISSUER_X = 'Eu5bU2TkAdEtaqWPhd1qdBuz7JCrA8n4yylmPoN_hQA'

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
  x: 'PHg1ezeis1eSSWF23EgH2VGbRghzszHhfV_dG22oOBU',
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
  // Cast: tören sonrası gömülü x'ler (as const literal) DEV_* ile örtüşmez → tsc
  // karşılaştırmayı "her zaman false" sayıp TS2367 verir. Runtime kontrolü korunur
  // (dev-anahtar bir gün geri gömülürse true döner — defense-in-depth).
  return (
    (LICENSE_ISSUER_PUBLIC_JWK.x as string) === DEV_ISSUER_X ||
    (RECEIPT_PUBLIC_JWK.x as string) === DEV_RECEIPT_X
  )
}
