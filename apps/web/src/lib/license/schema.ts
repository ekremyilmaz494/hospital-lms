import { z } from 'zod'

/**
 * Lisans ve makbuz claim şemaları — imza doğrulaması SONRASI payload'ı
 * biçimsel olarak da doğrular (DB/dosya tamperı, sürüm uyumsuzluğu).
 *
 * NOT (zod v4): z.object() bilinmeyen anahtarları SİLER — yeni claim eklerken
 * şemaya da eklenmeli, aksi halde route/state katmanı onu hiç görmez.
 */

/** Bu build'in anladığı en yüksek lisans şema sürümü. Daha yenisi → uygulama güncellenmeli. */
export const SUPPORTED_LICENSE_SCHEMA_VERSION = 1

export const licenseLimitsSchema = z.object({
  /** Tek kurulumda tanımlanabilecek en fazla organizasyon (null = sınırsız). */
  maxOrganizations: z.number().int().positive().nullable(),
  /** Aktif personel (staff) üst sınırı (null = sınırsız). */
  maxStaff: z.number().int().positive().nullable(),
  /**
   * Aynı lisansla eşzamanlı çalışabilecek en fazla KURULUM (instance) sayısı — gelir koruma
   * (bir lisansı N sunucuya klonlama). Heartbeat'te aşım → makbuz 'revoked' → LOCKED.
   * OPTIONAL + nullable ki daha ÖNCE üretilmiş lisanslar (bu alan yok) kırılmasın:
   *   yok(undefined) = eski lisans → zorlanmaz · null = sınırsız · sayı = zorlanır.
   */
  maxInstances: z.number().int().positive().nullable().optional(),
})

export const licenseClaimsSchema = z.object({
  iss: z.literal('klinovax-license'),
  /** licenseId — hem lisans dosyasının hem SaaS License kaydının birincil anahtarı. */
  jti: z.string().uuid(),
  /** Müşteri tanımlayıcısı (slug). */
  sub: z.string().min(1),
  iat: z.number().int(),
  schemaVersion: z.number().int().min(1),
  customerName: z.string().min(1),
  licenseType: z.enum(['standard', 'trial']),
  /** ISO-8601 bitiş tarihi; null = süresiz (kalıcı lisans). */
  validUntil: z.string().datetime().nullable(),
  limits: licenseLimitsSchema,
  /** Online doğrulama yapılamadan geçebilecek azami gün (offline tolerans). */
  graceDays: z.number().int().min(1).max(90),
})

export type LicenseClaims = z.infer<typeof licenseClaimsSchema>

export const receiptClaimsSchema = z.object({
  iss: z.literal('klinovax-receipt'),
  licenseId: z.string().uuid(),
  instanceId: z.string().uuid(),
  status: z.enum(['valid', 'revoked']),
  /** Sunucu saati — saat-geri-alma watermark'ını ileri sarar (güvenilir zaman kaynağı). */
  iat: z.number().int(),
  exp: z.number().int(),
  /**
   * Yenilenmiş lisans JWT'si (varsa) — süre uzatıldığında müşteri elle dosya
   * değiştirmeden bir sonraki heartbeat'te otomatik geçiş yapar.
   */
  renewedLicense: z.string().nullable().optional(),
})

export type ReceiptClaims = z.infer<typeof receiptClaimsSchema>
