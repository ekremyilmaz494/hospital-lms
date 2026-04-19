import crypto from 'node:crypto'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { getSmsProvider } from '@/lib/sms/netgsm'

/**
 * SMS OTP (One-Time Password) core logic.
 *
 * Akış:
 *   1) generateAndSendOtp(userId, phone): 6 haneli kod üret, Redis'e hash'le yaz, SMS gönder
 *   2) verifyOtp(userId, submittedCode): kullanıcının girdiği kodu doğrula
 *
 * Güvenlik tasarımı:
 *   - Redis'te kodun plaintext'i değil HMAC-SHA256 hash'i saklanır. Redis leak
 *     olsa bile saldırgan kodları okuyamaz.
 *   - TTL 5 dakika — süresi dolan kod Redis tarafından otomatik silinir.
 *   - Her userId için aynı anda tek aktif kod olur (yeni istek eski kodu ezer).
 *   - Rate limit API route katmanında uygulanır (generate öncesi), bu dosyada değil.
 */

export const OTP_LENGTH = 6
export const OTP_TTL_SECONDS = 5 * 60 // 5 dakika
export const OTP_MAX_ATTEMPTS = 5      // yanlış giriş üst limiti

const OTP_KEY_PREFIX = 'sms-otp:'

/** Redis'te tutulan OTP kaydının şekli. */
interface OtpRecord {
  /** HMAC-SHA256 hash'i (hex) — plaintext kod buraya asla yazılmaz */
  codeHash: string
  /** OTP'nin ilişkili olduğu telefon (telefon değişirse yeniden kod üretilmeli) */
  phone: string
  /** Yanlış deneme sayısı */
  attempts: number
  /** Unix ms: kod oluşturulma zamanı (debug/audit için) */
  createdAt: number
}

/**
 * Verify işleminin olası sonuçları.
 * API route bu enum'a göre kullanıcıya Türkçe mesaj döner.
 */
export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found'; message: string }      // kod yok (hiç üretilmemiş veya süresi doldu)
  | { ok: false; reason: 'expired'; message: string }        // TTL doldu
  | { ok: false; reason: 'too_many_attempts'; message: string } // deneme limiti aşıldı
  | { ok: false; reason: 'invalid'; message: string }        // kod yanlış (ama deneme hakkı var)
  | { ok: false; reason: 'phone_mismatch'; message: string } // kod başka telefona üretilmiş

// ─── Yardımcılar (INTERNAL) ───

function otpKey(userId: string): string {
  return `${OTP_KEY_PREFIX}${userId}`
}

/**
 * Kodu HMAC-SHA256 ile hash'ler. SECRET env'e bağlıdır — SECRET değişirse tüm
 * aktif OTP'ler geçersiz olur (kasıtlı: secret rotation = force-logout-OTP).
 */
function hashCode(code: string): string {
  const secret = process.env.OTP_HMAC_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-fallback-do-not-use-in-prod'
  return crypto.createHmac('sha256', secret).update(code).digest('hex')
}

/** Kriptografik olarak güvenli 6 haneli rastgele kod. Math.random KULLANMA. */
function generateSecureCode(): string {
  // 0-999999 aralığında uniform dağılım — modulo bias'ı önlemek için rejection sampling
  const max = 1_000_000
  const limit = Math.floor(0xffffffff / max) * max
  while (true) {
    const n = crypto.randomBytes(4).readUInt32BE(0)
    if (n < limit) {
      return (n % max).toString().padStart(OTP_LENGTH, '0')
    }
  }
}

// ─── Public API ───

/**
 * Yeni OTP üretir, Redis'e hash'li olarak kaydeder, SMS yollar.
 *
 * @returns `{ success: true }` SMS başarıyla yola çıktıysa
 *          `{ success: false, error }` SMS sağlayıcı hatası varsa
 *
 * Önemli: Bu fonksiyon rate-limit YAPMAZ. Çağıran API route
 * `checkRateLimit('sms-otp:send:<userId>', 3, 600)` gibi bir guard eklemeli.
 */
export async function generateAndSendOtp(params: {
  userId: string
  phone: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const code = generateSecureCode()
  const record: OtpRecord = {
    codeHash: hashCode(code),
    phone: params.phone,
    attempts: 0,
    createdAt: Date.now(),
  }

  const redis = getRedis()
  if (!redis) {
    logger.error('sms-otp', 'Redis yok — OTP üretilemedi')
    return { success: false, error: 'Sistem geçici olarak kullanılamıyor' }
  }

  try {
    await redis.set(otpKey(params.userId), JSON.stringify(record), { ex: OTP_TTL_SECONDS })
  } catch (err) {
    logger.error('sms-otp', 'Redis set başarısız', err)
    return { success: false, error: 'Sistem geçici olarak kullanılamıyor' }
  }

  const sms = await getSmsProvider().sendOtp({ phone: params.phone, code })
  if (!sms.success) {
    // SMS gitmedi — Redis kaydını temizle, kullanıcı beklememe yansın
    await redis.del(otpKey(params.userId)).catch(() => {})
    return { success: false, error: sms.errorMessage ?? 'SMS gönderilemedi' }
  }

  logger.info('sms-otp', 'OTP üretildi ve gönderildi', { userId: params.userId })
  return { success: true }
}

/**
 * Redis'teki OTP kaydını okur. Yoksa null döner.
 * Verify fonksiyonu için yardımcı — dışarı export edilmiyor normalde,
 * ancak verifyOtp kullanıcı tarafından yazılacağı için burada dışa açık.
 */
export async function loadOtpRecord(userId: string): Promise<OtpRecord | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<string>(otpKey(userId))
    if (!raw) return null
    // Upstash bazen otomatik parse ediyor, bazen string dönüyor — iki duruma da hazır ol
    return typeof raw === 'string' ? (JSON.parse(raw) as OtpRecord) : (raw as OtpRecord)
  } catch (err) {
    logger.error('sms-otp', 'Redis get başarısız', err)
    return null
  }
}

/**
 * OTP kaydını Redis'te günceller (attempts artırma gibi durumlar için).
 * TTL'i yeniden ayarlar — kod hâlâ orijinal TTL dakikası içinde geçerli.
 */
export async function updateOtpRecord(userId: string, record: OtpRecord): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  // TTL'i kaydın createdAt'ine göre hesapla ki toplam süre uzatılmış olmasın
  const elapsedSec = Math.floor((Date.now() - record.createdAt) / 1000)
  const remainingTtl = Math.max(1, OTP_TTL_SECONDS - elapsedSec)
  await redis.set(otpKey(userId), JSON.stringify(record), { ex: remainingTtl }).catch(() => {})
}

/**
 * OTP kaydını Redis'ten siler (başarılı doğrulama veya iptal sonrası).
 */
export async function deleteOtpRecord(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  await redis.del(otpKey(userId)).catch(() => {})
}

/**
 * Sabit-zamanlı string karşılaştırması. Timing attack'a karşı.
 * Hash'ler aynı uzunlukta olduğu için güvenli.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Bir OTP denemesinin hash'ini üretmek için export — verify fonksiyonu kullanır.
 */
export function hashSubmittedCode(code: string): string {
  return hashCode(code)
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬇⬇⬇ BU FONKSİYONU SEN YAZACAKSIN ⬇⬇⬇
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kullanıcının girdiği OTP kodunu doğrular.
 *
 * TODO(sen): Aşağıdaki davranışı implement et:
 *
 *   1. `loadOtpRecord(userId)` ile Redis'ten kaydı oku
 *      - null ise → `{ ok: false, reason: 'not_found', ... }` dön
 *
 *   2. `record.phone !== expectedPhone` ise → `phone_mismatch` dön
 *      (Ne zaman olur: kullanıcı kod isterken A numarası girmiş, verify'da
 *       session'daki phone B ise — saldırı işareti, logla)
 *
 *   3. `record.attempts >= OTP_MAX_ATTEMPTS` ise → `too_many_attempts` dön
 *      VE `deleteOtpRecord(userId)` ile kaydı sil (bir daha deneyemesin)
 *
 *   4. Girilen kodu hash'le: `hashSubmittedCode(submittedCode)`
 *      - `safeEqual(hash, record.codeHash)` ile timing-safe karşılaştır
 *      - Eşleşirse: `deleteOtpRecord(userId)` + `{ ok: true }` dön (one-shot use)
 *      - Eşleşmezse: `record.attempts++` + `updateOtpRecord()` + `invalid` dön
 *
 *   5. Her durumda `logger.info('sms-otp:verify', ...)` ile sonuç logla
 *      (userId, reason — submittedCode'u ASLA loglama, plaintext kod leak olur)
 *
 * Düşünmen gereken:
 *   - "Expired" durumu ayrı mı yoksa 'not_found'un parçası mı? (Redis TTL zaten
 *     expired kayıtları siliyor, yani `loadOtpRecord` null döner. Bu durumda
 *     'not_found' kullanmak yeterli — `expired` reason'ı verify içinde üretmene
 *     gerek yok. Ama örnek olarak bırakıyorum: kullanmak istersen kullan.)
 *   - `too_many_attempts` sonrası kullanıcı ne yapacak? Yeni kod istemeli mi?
 *     Rate limit zaten send tarafında var, cevap: evet yeni kod isteyebilir.
 *     Bu yüzden kaydı silmek (adım 3) doğru — kullanıcı "tekrar gönder"e basınca
 *     temiz başlangıç olur.
 *
 * Örnek mesajlar (Türkçe, kullanıcıya dönecek):
 *   not_found:         'Geçerli bir doğrulama kodu bulunamadı. Yeni kod talep edin.'
 *   phone_mismatch:    'Kod bu telefon numarası için geçerli değil.'
 *   too_many_attempts: 'Çok fazla yanlış deneme. Yeni bir kod talep edin.'
 *   invalid:           'Doğrulama kodu hatalı.'
 */
export async function verifyOtp(params: {
  userId: string
  submittedCode: string
  expectedPhone: string
}): Promise<OtpVerifyResult> {
  const { userId, submittedCode, expectedPhone } = params

  const record = await loadOtpRecord(userId)
  if (!record) {
    logger.info('sms-otp:verify', 'Kayit bulunamadi veya suresi doldu', { userId })
    return {
      ok: false,
      reason: 'not_found',
      message: 'Geçerli bir doğrulama kodu bulunamadı. Yeni kod talep edin.',
    }
  }

  // Attempts limiti önce kontrol — attacker phone farkı ile deneme hakkı yakamasın
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await deleteOtpRecord(userId)
    logger.warn('sms-otp:verify', 'Deneme limiti asildi', { userId, attempts: record.attempts })
    return {
      ok: false,
      reason: 'too_many_attempts',
      message: 'Çok fazla yanlış deneme. Yeni bir kod talep edin.',
    }
  }

  // Telefon uyumsuzluğu ciddi bir anomali — saldırı işareti
  if (record.phone !== expectedPhone) {
    logger.warn('sms-otp:verify', 'Telefon eslesmedi', { userId, recordPhone: record.phone.slice(-4) })
    return {
      ok: false,
      reason: 'phone_mismatch',
      message: 'Kod bu telefon numarası için geçerli değil.',
    }
  }

  const submittedHash = hashSubmittedCode(submittedCode)
  if (safeEqual(submittedHash, record.codeHash)) {
    await deleteOtpRecord(userId) // one-shot use
    logger.info('sms-otp:verify', 'Basarili dogrulama', { userId })
    return { ok: true }
  }

  // Yanlış kod: attempts'i artır, kaydı güncelle
  const updated: OtpRecord = { ...record, attempts: record.attempts + 1 }
  await updateOtpRecord(userId, updated)
  logger.info('sms-otp:verify', 'Gecersiz kod', { userId, attempts: updated.attempts })
  return {
    ok: false,
    reason: 'invalid',
    message: 'Doğrulama kodu hatalı.',
  }
}
