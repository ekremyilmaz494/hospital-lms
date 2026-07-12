/**
 * Grup yöneticisi (esas yönetici) yetkisi — TEK doğruluk kaynağı.
 *
 * Bir kullanıcının `/group/*` paneline + grup API'lerine (`withGroupRoute`) erişip
 * erişemeyeceğine KARAR VEREN tek fonksiyon. Çok-hastaneli müşterinin üst-katman
 * yöneticisidir: birden çok hastaneyi (Organization) konsolide görür ve drill-in ile yönetir.
 *
 * Dört yer buna güvenir ve AYNI kriteri kullanmalı (drift = güvenlik açığı/yönlendirme döngüsü):
 *   1. middleware (`/group/*` sayfa gate'i — JWT app_metadata'dan)
 *   2. api-handler (`withGroupRoute` — JWT/DB türevli claim'den)
 *   3. group layout guard (client store user'dan)
 *   4. group drill-in (api-handler acting-org `group_rw` modu)
 *
 * MODELLEME (`hasAdminAuthority` / `adminAccessGranted` deseninin ikizi): grup yöneticisi
 * YENİ bir UserRole DEĞİL. Sıradan bir `role='admin'` kullanıcıdır ama `organizationId=null`,
 * `groupId` set edilir ve JWT `app_metadata.group_owner=true` + `group_id=<id>` claim'leri
 * yazılır. Böylece rol-switch yapan hiçbir yer kırılmaz; null org'u onu doğal olarak drill-in'e
 * zorlar. Yetki grup-gözetim seviyesidir; hastane-admin yetkisinden (`hasAdminAuthority`)
 * ayrıdır. `super_admin` (platform) ASLA bu claim ile verilmez.
 *
 * Edge-safe: yalnız saf hesap; middleware bunu import eder (ağır bağımlılık yok).
 */
export interface GroupAuthorityInput {
  /** JWT app_metadata.group_owner veya DB türevli bayrak. */
  groupOwner?: boolean | null
  /** Bağlı olduğu grup id'si (JWT app_metadata.group_id / DB groupId). */
  groupId?: string | null
}

/**
 * Grup yönetici yetkisi var mı? HEM `group_owner=true` HEM de geçerli bir `groupId`
 * gerektirir — grubu olmayan başıboş bir bayrak yetki VERMEZ (fail-closed).
 */
export function hasGroupAuthority(input: GroupAuthorityInput | null | undefined): boolean {
  if (!input) return false
  return input.groupOwner === true && typeof input.groupId === 'string' && input.groupId.length > 0
}

/**
 * JWT app_metadata'dan grup claim'lerini güvenle çıkarır. group_owner boolean `true`
 * yazılır (olası string 'true' varyantına toleranslı); group_id UUID string'dir.
 */
export function extractGroupClaims(
  appMetadata: Record<string, unknown> | null | undefined,
): { groupOwner: boolean; groupId: string | null } {
  const rawOwner = appMetadata?.group_owner
  const rawId = appMetadata?.group_id
  return {
    groupOwner: rawOwner === true || rawOwner === 'true',
    groupId: typeof rawId === 'string' && rawId.length > 0 ? rawId : null,
  }
}
