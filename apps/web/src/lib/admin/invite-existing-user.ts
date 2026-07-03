/**
 * Yönetici davetinde TC (veya e-posta) çakışması sınıflandırması.
 *
 * Esas Yönetici bir "Yeni yönetici davet et" formu doldurduğunda, girilen TC zaten
 * sistemde kayıtlıysa eski davranış çıkmaz bir 409 hatasıydı ("bu TC ile zaten kullanıcı
 * var"). Oysa kişi çoğu zaman AYNI kurumun bir personelidir — bu durumda yeni hesap açmak
 * yerine mevcut personele ek yönetici yetkisi vermek (dual-capability, PR #234) doğru akış.
 *
 * Bu pure fonksiyon kararı tek yerde toplar (route + test aynı kaynağı kullanır). Route,
 * `grantable-staff` sonucunda frontend'e yapılandırılmış bir yanıt döner ve modal tek tıkla
 * `POST /api/admin/staff/[id]/admin-access` grant akışını sunar.
 */

export type ExistingTcUser = {
  id: string
  organizationId: string | null
  role: string
  firstName: string
  lastName: string
  adminAccessGranted: boolean
  isActive: boolean
}

export type ExistingTcDecision =
  /** Başka kuruma kayıtlı — tek-org kuralı, davet/grant edilemez. */
  | { kind: 'other-org' }
  /** Aynı kurumda zaten yönetici (rol admin/super_admin) — yeni davete gerek yok. */
  | { kind: 'already-admin'; fullName: string }
  /** Yönetici yetkisi zaten verilmiş personel — grant tekrarına gerek yok. */
  | { kind: 'already-granted'; fullName: string }
  /** Pasif personel — önce aktifleştirilmeli, sonra yetki verilebilir. */
  | { kind: 'inactive-staff'; fullName: string }
  /** Aktif, yetkisiz personel — mevcut personele yönetici yetkisi verilebilir. */
  | { kind: 'grantable-staff'; id: string; firstName: string; lastName: string; fullName: string }

/**
 * Davet edilmeye çalışılan TC'ye sahip mevcut kullanıcıyı, davet eden Esas Yönetici'nin
 * org'una göre sınıflandırır. `orgId` = davet eden yöneticinin (owner) organizasyonu.
 */
export function classifyExistingTcUser(user: ExistingTcUser, orgId: string): ExistingTcDecision {
  if (user.organizationId !== orgId) return { kind: 'other-org' }

  const fullName = `${user.firstName} ${user.lastName}`.trim()

  if (user.role !== 'staff') return { kind: 'already-admin', fullName }
  if (user.adminAccessGranted) return { kind: 'already-granted', fullName }
  if (!user.isActive) return { kind: 'inactive-staff', fullName }

  return { kind: 'grantable-staff', id: user.id, firstName: user.firstName, lastName: user.lastName, fullName }
}
