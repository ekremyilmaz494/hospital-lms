import { prisma } from '@/lib/prisma'

/**
 * Bir personelin bağlı olduğu TÜM hastane (org) id'leri: PRIMARY (`User.organizationId`) +
 * aktif ÜYELİK'ler (`OrganizationMembership`, çok-hastaneli grup "ortak personel"i).
 *
 * Kullanım: staff okuma + sınav (exam) yollarında `organizationId = dbUser.organizationId`
 * tek-org filtresi yerine bu set + `{ in: orgIds }` kullanılır → ortak doktor tek girişle HER
 * hastanesindeki eğitimi/sertifikayı/bildirimi görür VE tamamlar (birleşik gelen kutusu, Faz 2.4).
 *
 * TEKİL-ORG personelde (üyelik yok) `[primaryOrgId]` döner → `{ in: [A] }` ≡ `= A` (INERT):
 * mevcut tek-hastane müşteriler (ör. Devakent) hiç etkilenmez, davranış BİREBİR korunur.
 *
 * Güvenlik: dönen set yalnız kullanıcının KENDİ primary'si + KENDİ aktif üyeliklerini içerir;
 * exam sorguları zaten `userId` ile de scope'lu (kullanıcı yalnız kendi verisine erişir).
 */
export async function getStaffOrgIds(userId: string, primaryOrgId: string): Promise<string[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId, isActive: true },
    select: { organizationId: true },
  })
  // Disjoint invariant (üyelik org ≠ primary) gereği çakışma olmaz; yine de Set ile güvene al.
  const ids = new Set<string>([primaryOrgId])
  for (const m of memberships) ids.add(m.organizationId)
  return [...ids]
}
