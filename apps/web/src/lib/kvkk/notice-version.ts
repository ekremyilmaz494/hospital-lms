/**
 * KVKK Aydınlatma Metni sürüm numarası — TEK doğruluk kaynağı.
 *
 * Metin (`app/kvkk/page.tsx`) esaslı biçimde değiştiğinde bu sayıyı ARTIR: kullanıcıların
 * `User.kvkkNoticeVersion`'ı bundan küçük kalır → middleware onları yeniden onaya yönlendirir
 * (mevcut aydınlatma modalı akışı). Böylece güncel metne yeniden açık rıza/teyit alınır.
 *
 * Edge-safe: yalnız sabit; middleware bunu import eder (ağır bağımlılık yok).
 */
export const KVKK_NOTICE_VERSION = 1
