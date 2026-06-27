import { z } from 'zod/v4'

/**
 * Parola politikası — TEK doğruluk kaynağı.
 *
 * Önceden parola kuralları 5 ayrı zod şemasına dağılmıştı ve tutarsızdı
 * (kayıt: özel karakter zorunlu; şifre-değiştir: yalnız min-8; davet: özel karakter yok).
 * Tüm parola kuran akışlar (kayıt, davet kabul, admin kullanıcı oluşturma, şifre değiştir)
 * artık buradaki tek `passwordSchema`'yı kullanır.
 *
 * Not: `lib/passwords.ts:generateTempPassword()` ("Pass"+8hex+"!1") bu politikayı geçecek
 * şekilde tasarlandı (büyük+küçük+rakam+özel karakter içerir).
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
} as const

/** En az bir büyük + küçük + rakam + özel karakter (lookahead'ler). */
const COMPLEXITY_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?])/

const COMPLEXITY_MSG =
  'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'

/** Tüm parola kuran akışların ortak doğrulayıcısı. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, `Şifre en az ${PASSWORD_POLICY.minLength} karakter olmalıdır`)
  .max(PASSWORD_POLICY.maxLength, `Şifre en fazla ${PASSWORD_POLICY.maxLength} karakter olabilir`)
  .regex(COMPLEXITY_RE, COMPLEXITY_MSG)

/** İnsan-okunur politika maddeleri — Güvenlik Ayarları'nda gösterilir. */
export const PASSWORD_POLICY_RULES: readonly string[] = [
  `En az ${PASSWORD_POLICY.minLength} karakter (en fazla ${PASSWORD_POLICY.maxLength})`,
  'En az bir büyük harf (A–Z)',
  'En az bir küçük harf (a–z)',
  'En az bir rakam (0–9)',
  'En az bir özel karakter (!@#$%^&* …)',
]
