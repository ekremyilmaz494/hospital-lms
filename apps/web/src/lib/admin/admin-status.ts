/**
 * Esas Yönetici'nin bir GERÇEK yöneticiyi (rol='admin') pasife alma / yeniden aktifleştirme
 * kararının izin + durum doğrulaması. Pure fonksiyon — route ve test aynı kaynağı kullanır.
 *
 * Yetki verilmiş personel (rol='staff', adminAccessGranted) için bu AKIŞ DEĞİL:
 * onların yetkisi `DELETE /api/admin/staff/[id]/admin-access` ile kaldırılır (düz personele
 * döner). Bu helper yalnız gerçek admin hesaplarının aktiflik durumunu yönetir.
 *
 * "Pasife al" seçildi (kullanıcı tercihi 2026-07-03): hesap silinmez, `isActive=false` olur →
 * giriş engellenir, bir yönetici koltuğu boşalır, geri-dönüşlüdür (Aktifleştir).
 */

export type AdminStatusTarget = {
  id: string
  organizationId: string | null
  role: string
  isActive: boolean
}

export type AdminStatusAction = 'deactivate' | 'reactivate'

export type AdminStatusDecision =
  | { ok: true }
  | { ok: false; status: number; message: string }

/**
 * @param target  Hedef kullanıcı (yoksa null → 404 fingerprint).
 * @param orgId   İsteği yapan Esas Yönetici'nin organizasyonu (tenant scope).
 * @param ownerUserId  Organization.ownerUserId.
 * @param requesterId  İsteği yapan kullanıcı (dbUser.id).
 * @param action  'deactivate' (pasife al) | 'reactivate' (aktifleştir).
 */
export function resolveAdminStatusChange(params: {
  target: AdminStatusTarget | null
  orgId: string
  ownerUserId: string | null
  requesterId: string
  action: AdminStatusAction
}): AdminStatusDecision {
  const { target, orgId, ownerUserId, requesterId, action } = params

  // Yalnız Esas Yönetici (defense-in-depth — sayfa zaten owner-only redirect yapıyor).
  if (!ownerUserId || ownerUserId !== requesterId) {
    return { ok: false, status: 403, message: 'Bu işlem yalnızca Esas Yönetici tarafından yapılabilir' }
  }

  // Hedef yok veya başka org → var/yok sızdırmamak için tek 404.
  if (!target || target.organizationId !== orgId) {
    return { ok: false, status: 404, message: 'Yönetici bulunamadı' }
  }

  // Esas Yönetici kendi durumunu değiştiremez (owner satırı UI'da zaten "—").
  if (target.id === requesterId || target.id === ownerUserId) {
    return { ok: false, status: 400, message: 'Esas Yönetici kendi yöneticilik durumunu değiştiremez' }
  }

  // super_admin bu yoldan asla değiştirilmez.
  if (target.role === 'super_admin') {
    return { ok: false, status: 403, message: 'Süper admin hesabı bu yoldan değiştirilemez' }
  }

  // staff → yanlış akış; yetki grant/revoke ile yönetilir.
  if (target.role !== 'admin') {
    return { ok: false, status: 400, message: 'Bu işlem yalnızca yönetici hesapları içindir' }
  }

  // Durum idempotency — zaten istenen durumdaysa net mesaj.
  if (action === 'deactivate' && !target.isActive) {
    return { ok: false, status: 409, message: 'Bu yönetici zaten pasif' }
  }
  if (action === 'reactivate' && target.isActive) {
    return { ok: false, status: 409, message: 'Bu yönetici zaten aktif' }
  }

  return { ok: true }
}
