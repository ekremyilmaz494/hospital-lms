/**
 * KVKK Aydınlatma Metni sürüm numarası — TEK doğruluk kaynağı.
 *
 * Metin (`app/kvkk/page.tsx`) esaslı biçimde değiştiğinde bu sayıyı ARTIR: kullanıcıların
 * `User.kvkkNoticeVersion`'ı bundan küçük kalır → middleware onları yeniden onaya yönlendirir
 * (mevcut aydınlatma modalı akışı). Böylece güncel metne yeniden açık rıza/teyit alınır.
 *
 * Edge-safe: yalnız sabit; middleware bunu import eder (ağır bağımlılık yok).
 *
 * v2 (Temmuz 2026): kimlik konsolidasyonu + aktarım maddesi genelleştirildi
 */
export const KVKK_NOTICE_VERSION = 2

/**
 * Kullanıcının GÜNCEL aydınlatma metnini onaylamış olup olmadığını döndürür.
 * Onay tarihi dolu OLMALI **ve** onaylanan sürüm >= güncel sürüm olmalı. Sürüm alanı
 * yoksa (versiyonlama öncesi onaylayanlar) v1 kabul edilir (grandfather).
 *
 * TEK doğruluk kaynağı: middleware KVKK guard'ı ile login sayfasının modal-tetiği
 * bu fonksiyonu KULLANMALI. İki taraf kriteri ayrı hesaplarsa (biri sürüm-duyarlı,
 * diğeri yalnız onay-tarihi-dolu-mu) sürüm yükseltmesinde sonsuz döngü doğar
 * (2026-07: v1 onaylı kullanıcı `/dashboard ⇄ /auth/login?reason=kvkk-required`
 * döngüsüne giriyordu). Edge-safe: yalnız saf hesap, ağır bağımlılık yok.
 */
export function isKvkkNoticeCurrent(
  userMetadata:
    | { kvkk_notice_acknowledged_at?: unknown; kvkk_notice_version?: unknown }
    | null
    | undefined,
): boolean {
  if (!userMetadata?.kvkk_notice_acknowledged_at) return false
  const rawVersion = userMetadata.kvkk_notice_version
  const version = rawVersion == null ? 1 : Number(rawVersion)
  return Number.isFinite(version) && version >= KVKK_NOTICE_VERSION
}
