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
