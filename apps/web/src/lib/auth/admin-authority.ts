/**
 * Yönetici (hastane-admin) yetkisi — TEK doğruluk kaynağı.
 *
 * Bir kullanıcının `/admin/*` paneline + admin API'lerine erişip erişemeyeceğine
 * KARAR VEREN tek fonksiyon. Dört yer buna güvenir ve AYNI kriteri kullanmalı:
 *   1. middleware (`/admin/*` sayfa gate'i — JWT app_metadata'dan)
 *   2. api-handler (`withAdminRoute` → requireRole — DB dbUser'dan)
 *   3. admin layout guard (client store user'dan)
 *   4. sidebar/nav (granted staff'a yönetim bağlantısı)
 *
 * İki yer kriteri ayrı hesaplarsa güvenlik açığı/yönlendirme döngüsü doğar
 * (bkz. 2026-07 KVKK sürüm döngüsü — aynı drift sınıfı).
 *
 * Yetki İKİ kaynaktan gelir:
 *   - `role`: 'admin' | 'super_admin' → doğal yönetici.
 *   - `adminAccess`: Esas Yönetici'nin bir PERSONELE verdiği ek yetki bayrağı
 *     (kişi `role='staff'` olarak kalır, eğitim almaya devam eder; bkz.
 *     `User.adminAccessGranted` + JWT `app_metadata.admin_access`).
 *
 * ÖNEMLİ: Bu yetki yalnız HASTANE-ADMIN seviyesidir. `super_admin` (platform)
 * yetkisi ASLA grant ile verilmez — super-admin route'ları ayrıca `role === 'super_admin'`
 * kontrol eder ve bu fonksiyondan etkilenmez.
 *
 * Edge-safe: yalnız saf hesap; middleware bunu import eder (ağır bağımlılık yok).
 */
export interface AdminAuthorityInput {
  /** JWT app_metadata.role veya DB dbUser.role */
  role: string | null | undefined
  /** Personele verilmiş ek yönetici yetkisi (DB adminAccessGranted / JWT admin_access) */
  adminAccess?: boolean | null
}

export function hasAdminAuthority(input: AdminAuthorityInput | null | undefined): boolean {
  if (!input) return false
  if (input.role === 'admin' || input.role === 'super_admin') return true
  return input.adminAccess === true
}

/**
 * JWT app_metadata'dan `admin_access` claim'ini güvenle boolean'a çevirir.
 * Claim boolean `true` olarak yazılır; olası string ('true') varyantına karşı toleranslı.
 */
export function extractAdminAccess(
  appMetadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = appMetadata?.admin_access
  return raw === true || raw === 'true'
}
