import type { Prisma } from '@/generated/prisma/client'
import type { UserRole } from '@/types/database'

/**
 * Çok-hastaneli grup — "ortak personel" org-kapsamı yardımcıları (Track 2).
 *
 * Bir hastanenin (org) personeli iki şekilde bağlı olabilir:
 *   1) PRIMARY  — `User.organizationId = orgId` (ev/asıl hastane; mevcut tekil-org modeli)
 *   2) ÜYELİK    — `OrganizationMembership(organizationId=orgId, isActive=true)` (EK hastane,
 *                  çok-hastaneli grupta paylaşılan çalışan)
 *
 * `orgStaffWhere(orgId)` ikisini de kapsayan `User` where filtresi döner → bir hastanenin
 * personel listesi/atama/rapor sorguları paylaşılan çalışanı da görür. Tekil-org müşteriler
 * için üyelik hiç olmadığından davranış AYNI kalır (OR'ın 2. dalı sıfır satır eşler).
 *
 * NOT: Üyelik boşken (Faz 2.1/2.2, henüz provizyon yok) bu helper eski `{organizationId, role:'staff'}`
 * ile BİREBİR aynı sonuç verir → güvenli/inert geçiş. Provizyon (Faz 2.3) açılınca canlanır.
 */
export function orgStaffWhere(orgId: string): Prisma.UserWhereInput {
  return {
    role: 'staff' satisfies UserRole,
    OR: [
      { organizationId: orgId },
      { memberships: { some: { organizationId: orgId, isActive: true } } },
    ],
  }
}

/**
 * `orgStaffWhere` ile ek AND-filtreleri (departman, arama, aktiflik…) birleştirir.
 *
 * DİKKAT: doğrudan spread (`{ ...orgStaffWhere(orgId), departmentId }`) `orgStaffWhere`'in
 * `OR` dalını KORUR ama caller kendi `OR`'unu (ör. isim araması) eklerse iki `OR` çakışır —
 * Prisma'da sadece son `OR` kalır. Bu helper her iki koşulu `AND` dizisine koyarak güvenli
 * birleştirir. Ek filtrelerde `role`/`OR` verme (helper zaten koyar).
 */
export function withOrgStaffScope(
  orgId: string,
  extra: Prisma.UserWhereInput = {},
): Prisma.UserWhereInput {
  const base = orgStaffWhere(orgId)
  // extra kendi OR'unu taşıyorsa (ör. arama), base.OR ile AND'le — aksi halde biri diğerini ezerdi.
  if (extra.OR || extra.AND) {
    return { role: base.role, AND: [{ OR: base.OR }, extra] }
  }
  return { ...base, ...extra }
}
