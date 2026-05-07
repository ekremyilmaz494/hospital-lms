/**
 * Geçici şifre üretimi.
 *
 * Tek noktada tutuluyor çünkü hem tek-personel ekleme (`/api/admin/staff`)
 * hem toplu yükleme (`/api/admin/bulk-import`) hem davet kabul (`/api/auth/accept-invite`)
 * akışı aynı şifre formatını üretmeli — admin "ah bu farklı" demesin.
 *
 * Format: "Pass" + 8 hex (uppercase) + "!1"
 *   • 14 karakter sabit uzunluk
 *   • Büyük harf, küçük harf, rakam, özel karakter — Supabase Auth password policy'si
 *     (en az 8 karakter, complexity yok ama biz proaktif tutuyoruz)
 *   • Hex segment yeterli entropi (8 hex = 32 bit, brute force makul ötesi)
 *   • İlk girişte değiştirilmesi zorunlu (User.mustChangePassword=true)
 *     olduğu için kalıcı kullanılmaz; "geçici" rolüne uygun.
 */
import { randomBytes } from 'node:crypto'

export function generateTempPassword(): string {
  return 'Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1'
}
