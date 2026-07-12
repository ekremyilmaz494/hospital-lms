import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkStaffLimit } from '@/lib/subscription-guard'
import { orgInOwnerGroup } from '@/lib/auth/group-drill-in'
import { addStaffMembershipSchema, removeStaffMembershipSchema } from '@/lib/validations'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/database'

/**
 * Ortak personel üyelikleri (çok-hastaneli grup, Track 2 Faz 2.3).
 *
 * Bir personeli grup içindeki BAŞKA bir hastaneye EK üyelikle bağlar → o çalışan tek hesapla
 * ikinci hastanede de eğitim alır/atanabilir. User.organizationId (primary) DEĞİŞMEZ; üyelik
 * additive. Yalnız GRUP YÖNETİCİSİ (esas yönetici) provizyon yapar: bir kaynak hastaneye
 * drill-in yapıp (effectiveOrgId=kaynak) o hastanenin personelini grup-içi hedef hastaneye ekler.
 * Sıradan hastane admini (groupId=null) veya super_admin (drill-in salt-okunur) bu yolu KULLANAMAZ.
 *
 * Guard zinciri: (1) çağıran grup yöneticisi mi (dbUser.groupId), (2) personel kaynak org'un
 * staff'ı mı, (3) hedef ≠ primary org (disjoint invariant), (4) hedef owner'ın grubunda + aktif mi
 * (orgInOwnerGroup, askı-kontrollü), (5) departman hedef org'a ait mi, (6) hedef org'un seat limiti.
 */

/** Yalnız grup yöneticisi provizyon yapabilir (drill-in ile kaynak org context'inde). */
function requireGroupOwner(dbUser: { groupId: string | null }): asserts dbUser is { groupId: string } {
  if (!dbUser.groupId) {
    throw new ApiError('Ortak personel yalnız grup yöneticisi tarafından eklenir/kaldırılır.', 403)
  }
}

// GET — personelin tüm üyeliklerini (hangi hastanelere EK-bağlı) döner.
export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  requireGroupOwner(dbUser)
  const { id } = params

  // Bağımsız iki okuma paralel (personel-varlık guard'ı + üyelik listesi).
  const [staff, memberships] = await Promise.all([
    prisma.user.findFirst({
      where: { id, organizationId, role: 'staff' satisfies UserRole },
      select: { id: true },
    }),
    prisma.organizationMembership.findMany({
      where: { userId: id },
      select: {
        id: true, organizationId: true, departmentId: true, title: true, isActive: true, createdAt: true,
        organization: { select: { name: true, code: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!staff) throw new ApiError('Personel bulunamadı.', 404)

  return jsonResponse({ memberships }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

// POST — personeli grup-içi hedef hastaneye ekle.
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  requireGroupOwner(dbUser)
  const { id } = params
  const sourceOrgId = organizationId // drill-in ile kaynak hastane (personelin primary org'u)

  const allowed = await checkRateLimit(`staff-membership:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody(request)
  const parsed = addStaffMembershipSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  const { organizationId: targetOrgId, departmentId, title } = parsed.data

  // (2) Personel kaynak org'un staff'ı mı
  const staff = await prisma.user.findFirst({
    where: { id, organizationId: sourceOrgId, role: 'staff' satisfies UserRole },
    select: { id: true, organizationId: true, firstName: true, lastName: true },
  })
  if (!staff) throw new ApiError('Personel bu hastanede bulunamadı.', 404)

  // (3) Hedef ≠ personelin primary org'u (disjoint invariant — primary zaten kapsar)
  if (targetOrgId === staff.organizationId) {
    throw new ApiError('Personel zaten bu hastanenin asıl kadrosunda. Ek üyelik gerekmez.', 400)
  }

  // (4) Hedef, grup yöneticisinin grubunda + AKTİF (askıya alınmış/çıkarılmış hastane reddedilir)
  const targetInGroup = await orgInOwnerGroup(targetOrgId, dbUser.groupId)
  if (!targetInGroup) {
    throw new ApiError('Hedef hastane bu gruba ait değil veya aktif değil.', 403)
  }

  // (5) Departman (verilmişse) hedef org'a ait mi
  if (departmentId) {
    const dept = await prisma.department.findFirst({ where: { id: departmentId, organizationId: targetOrgId }, select: { id: true } })
    if (!dept) throw new ApiError('Departman hedef hastanede bulunamadı.', 400)
  }

  // (6) Hedef org'un seat limiti (her hastane ortak çalışan için ayrı koltuk öder)
  const seatBlock = await checkStaffLimit(targetOrgId, 1)
  if (seatBlock) return seatBlock

  try {
    const created = await prisma.organizationMembership.create({
      data: { userId: id, organizationId: targetOrgId, role: 'staff' satisfies UserRole, departmentId: departmentId ?? null, title: title ?? null },
      select: { id: true, organizationId: true, departmentId: true, title: true },
    })

    // Hedef hastanenin personel-liste cache'i artık paylaşılan çalışanı içermeli.
    await invalidateOrgCache(targetOrgId, 'staff').catch((e) => logger.warn('staff-membership', 'cache invalidation başarısız', e instanceof Error ? e.message : e))

    await audit({
      action: 'staff.membership.add',
      entityType: 'organization_membership',
      entityId: created.id,
      newData: { userId: id, targetOrgId, departmentId: departmentId ?? null, title: title ?? null },
    })

    return jsonResponse({ membership: created }, 201)
  } catch (err) {
    // Unique [user, org] ihlali → zaten üye
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new ApiError('Personel zaten bu hastaneye ek üyelikle bağlı.', 409)
    }
    logger.error('staff-membership', 'Üyelik oluşturulamadı', { error: err instanceof Error ? err.message : err })
    throw new ApiError('Üyelik oluşturulamadı.', 500)
  }
}, { requireOrganization: true })

// DELETE — personeli hedef hastaneden çıkar (ek üyeliği kaldır; primary'e dokunmaz).
export const DELETE = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  requireGroupOwner(dbUser)
  const { id } = params

  const allowed = await checkRateLimit(`staff-membership:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody(request)
  const parsed = removeStaffMembershipSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  const { organizationId: targetOrgId } = parsed.data

  // Personel kaynak org'un staff'ı mı (yetki sınırı — grup yöneticisi kendi drill-in'indeki personeli yönetir)
  const staff = await prisma.user.findFirst({
    where: { id, organizationId, role: 'staff' satisfies UserRole },
    select: { id: true },
  })
  if (!staff) throw new ApiError('Personel bu hastanede bulunamadı.', 404)

  // Hedef, grup yöneticisinin grubunda mı (yabancı org'un üyeliğini silmeyi engelle)
  const targetInGroup = await orgInOwnerGroup(targetOrgId, dbUser.groupId)
  if (!targetInGroup) throw new ApiError('Hedef hastane bu gruba ait değil.', 403)

  const deleted = await prisma.organizationMembership.deleteMany({ where: { userId: id, organizationId: targetOrgId } })
  if (deleted.count === 0) throw new ApiError('Bu hastanede ek üyelik bulunamadı.', 404)

  await invalidateOrgCache(targetOrgId, 'staff').catch((e) => logger.warn('staff-membership', 'cache invalidation başarısız', e instanceof Error ? e.message : e))

  await audit({
    action: 'staff.membership.remove',
    entityType: 'organization_membership',
    entityId: id,
    oldData: { userId: id, targetOrgId },
  })

  return jsonResponse({ removed: deleted.count })
}, { requireOrganization: true })
