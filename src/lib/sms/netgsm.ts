import { logger } from '@/lib/logger'
import type { SmsProvider, SmsSendResult } from './types'

/**
 * NetGSM OTP SMS client.
 *
 * Dokümantasyon: https://www.netgsm.com.tr/dokuman/
 * Endpoint: https://api.netgsm.com.tr/sms/rest/v2/send
 *
 * NetGSM iki ayrı SMS kanalı sunar:
 *   - Normal SMS (pazarlama) — IYS onayı + kullanıcı izni gerekir
 *   - OTP SMS (işlemsel) — IYS muafiyetli, sadece doğrulama amaçlı
 *
 * Bu client yalnızca OTP kanalını kullanır. Kullanıcının abonelik durumu/IYS izni
 * sorgulanmaz çünkü OTP tüm kullanıcılara yasal olarak gönderilebilir.
 *
 * Environment variables:
 *   NETGSM_USERCODE  — panel kullanıcı kodu
 *   NETGSM_PASSWORD  — API şifresi (panel şifresinden farklı, panelde ayrı üretilir)
 *   NETGSM_MSGHEADER — onaylanmış sender ID (örn "HASTANELMS", 11 char, ASCII)
 *
 * Dev mode: eğer NETGSM_USERCODE tanımlı değilse gerçek SMS atılmaz, kod console'a
 * basılır. Böylece geliştirme sırasında credential bekletmeden flow test edilebilir.
 */

const NETGSM_API_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send'

// NetGSM hata kodları — dokümantasyondan
// 0: başarılı, geri kalanlar hata
const NETGSM_ERROR_MESSAGES: Record<string, string> = {
  '20': 'Mesaj metni hatalı veya çok uzun',
  '30': 'Geçersiz kullanıcı/şifre',
  '40': 'Mesaj başlığı sistemde tanımlı değil',
  '50': 'IYS kontrolü başarısız',
  '60': 'Hesap aktif değil',
  '70': 'Parametre hatası',
  '80': 'Gönderim limiti aşıldı',
  '85': 'Mükerrer gönderim limiti',
  '100': 'Sistem hatası',
}

/** Türkiye telefon numarasını NetGSM formatına çevir: "+905551234567" → "5551234567" */
function normalizePhoneForNetGsm(phone: string): string {
  // Boşluk, tire, parantez temizle
  const cleaned = phone.replace(/[\s\-()]/g, '')
  // +90 veya 90 prefix'ini at, 0 prefix'ini at
  if (cleaned.startsWith('+90')) return cleaned.slice(3)
  if (cleaned.startsWith('90') && cleaned.length === 12) return cleaned.slice(2)
  if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.slice(1)
  return cleaned
}

function isMockMode(): boolean {
  return !process.env.NETGSM_USERCODE || process.env.NETGSM_USERCODE === ''
}

async function sendOtp(params: { phone: string; code: string }): Promise<SmsSendResult> {
  const phone = normalizePhoneForNetGsm(params.phone)

  // TR cep telefonu formatı: 5XXXXXXXXX (10 hane, 5 ile başlar)
  if (!/^5\d{9}$/.test(phone)) {
    logger.warn('sms:netgsm', 'Geçersiz telefon formatı', { phone: params.phone })
    return {
      success: false,
      errorCode: 'INVALID_PHONE',
      errorMessage: 'Geçersiz telefon numarası formatı',
    }
  }

  const message = `Hastane LMS doğrulama kodunuz: ${params.code}. Kod 5 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.`

  // Dev/test fallback: credential yoksa console'a bas
  if (isMockMode()) {
    logger.info('sms:netgsm:mock', `[MOCK SMS] ${params.phone} → ${params.code}`, {
      phone,
      message,
    })
    return { success: true, messageId: `mock-${Date.now()}` }
  }

  try {
    const response = await fetch(NETGSM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgheader: process.env.NETGSM_MSGHEADER,
        encoding: 'TR', // Türkçe karakter destekli
        messages: [{ msg: message, no: phone }],
        iysfilter: '', // OTP için IYS filtresi boş — muafiyet
      }),
      // NetGSM bazen yavaş, timeout 10sn
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      logger.error('sms:netgsm', `HTTP hatası: ${response.status}`)
      return {
        success: false,
        errorCode: `HTTP_${response.status}`,
        errorMessage: 'SMS sağlayıcısına ulaşılamadı',
      }
    }

    const data = await response.json() as { code?: string; jobid?: string; description?: string }

    if (data.code === '0' || data.code === '00') {
      logger.info('sms:netgsm', 'SMS başarıyla gönderildi', { jobid: data.jobid, phone })
      return { success: true, messageId: data.jobid }
    }

    const errorMsg = NETGSM_ERROR_MESSAGES[data.code ?? ''] ?? data.description ?? 'Bilinmeyen NetGSM hatası'
    logger.error('sms:netgsm', `NetGSM hata: ${data.code} - ${errorMsg}`, { phone })
    return {
      success: false,
      errorCode: data.code,
      errorMessage: errorMsg,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    logger.error('sms:netgsm', `Gönderim başarısız: ${message}`, { phone })
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'SMS gönderilemedi, lütfen tekrar deneyin',
    }
  }
}

export const netgsmProvider: SmsProvider = { sendOtp }

/** Aktif sağlayıcıyı döndürür. İleride env'e göre switch yapılabilir. */
export function getSmsProvider(): SmsProvider {
  return netgsmProvider
}
