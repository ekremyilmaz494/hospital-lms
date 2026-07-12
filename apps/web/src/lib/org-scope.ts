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

/**
 * DEPARTMAN-farkındalıklı ortak-personel org-kapsamı (Track 2).
 *
 * `orgStaffWhere`/`withOrgStaffScope` departman filtresini TOP-LEVEL `User.departmentId`'ye koyar.
 * Bu, ÜYELİK dalındaki ortak doktoru YANLIŞ eler: ortak doktorun `User.departmentId`'si PRIMARY
 * hastanesine (A) aittir; EK hastanedeki (B) departmanı `OrganizationMembership.departmentId`'de
 * durur (org-özel — her hastanede farklı olabilir). Bir sorgu departman ile filtreliyorsa, filtre
 * HER İKİ dala AYRI eşlenmeli: primary dal `User.departmentId`, üyelik dalı `membership.departmentId`.
 *
 * Bu helper aynı `deptFilter`'ı iki dala da spread ederek bunu tek/test-edilebilir noktada yapar →
 * ~8 rapor/export/atama route'unda elle OR kurup kopya-yapıştır tenant hatası riskini önler.
 *
 * @param deptFilter `{ departmentId }` / `{ departmentId: { in: subtree } }` / `{}` (dept yok → inert).
 *   `_shared.ts` `userDeptFilter`'ı (`Record<string, unknown>`) doğrudan geçirilebilir. Boşken üyelik
 *   dalı yalnız `organizationId`+`isActive` eşler → tekil-org müşteride 0 satır (davranış korunur).
 * @param opts.isActive verilirse üst düzey `User.isActive` AND'i (her iki dalı da kapsar).
 */
export function orgStaffWhereByDept(
  orgId: string,
  deptFilter: Record<string, unknown> = {},
  opts: { isActive?: boolean } = {},
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {
    role: 'staff' satisfies UserRole,
    OR: [
      { organizationId: orgId, ...deptFilter },
      { memberships: { some: { organizationId: orgId, isActive: true, ...deptFilter } } },
    ],
  }
  if (opts.isActive !== undefined) where.isActive = opts.isActive
  return where
}
