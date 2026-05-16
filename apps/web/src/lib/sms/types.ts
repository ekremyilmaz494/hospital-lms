/**
 * SMS sağlayıcı soyutlaması.
 * Şu an NetGSM kullanılıyor; ileride İleti Merkezi / Twilio gibi başka sağlayıcıya
 * geçilirse sadece provider implementasyonu değişir, çağıran kod aynı kalır.
 */

export interface SmsSendResult {
  success: boolean
  /** Sağlayıcının döndürdüğü mesaj kimliği (takip/fatura için) */
  messageId?: string
  /** Başarısızsa hata kodu (sağlayıcıya özgü) */
  errorCode?: string
  /** Başarısızsa insan-okunur hata mesajı (Türkçe) */
  errorMessage?: string
}

export interface SmsProvider {
  /** Tek bir telefon numarasına OTP SMS'i gönder. Numara E.164 formatında (+90...) olmalı. */
  sendOtp(params: { phone: string; code: string }): Promise<SmsSendResult>
}
