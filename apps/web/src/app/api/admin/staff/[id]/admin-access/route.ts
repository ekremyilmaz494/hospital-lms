import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, invalidateAuthCache } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * POST/DELETE /api/admin/staff/[id]/admin-access
 *
 * Esas Yönetici (org owner) bir PERSONELE ek yönetici (hastane-admin) yetkisi VERİR/KALDIRIR.
 * Kişi `role='staff'` olarak KALIR (eğitim almaya devam eder) ama /admin paneline erişir
 * (dual-capability). Yetki İKİ katmanda tutulur ve TEK kaynaktan (lib/auth/admin-authority)
 * okunur:
 *   - DB `User.adminAccessGranted` → API guard'ı (api-handler) buradan okur (anında etkili).
 *   - JWT `app_metadata.admin_access` → middleware sayfa gate'i buradan okur (token yenilenince).
 *
 * KURALLAR:
 *   - Yalnız Esas Yönetici (`Organization.ownerUserId === dbUser.id`). Sıradan admin 403.
 *   - Hedef aynı org'da, aktif, `role='staff'` olmalı. admin/super_admin hedef reddedilir.
 *   - Grant, ücretli koltuk limitine (`maxAdmins`) SAYILIR: aktif admin + grant'lı staff +
 *     bekleyen admin daveti >= maxAdmins ise reddedilir (gelir koruması).
 *   - super_admin yetkisi ASLA verilmez (bu yalnız hastane-admin seviyesidir).
 */

type OrgInfo = { ownerUserId: string | null; maxAdmins: number }
type TargetInfo = { id: string; organizationId: string | null; role: string; isActive: boolean; adminAccessGranted: boolean }

/** Owner + hedef doğrulaması. Hata varsa Response, aksi halde {org, target} döner. */
async function loadOwnerAndTarget(
  orgId: string,
  ownerId: string,
  targetId: string,
): Promise<Response | { org: OrgInfo; target: TargetInfo }> {
  const [org, target] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerUserId: true, maxAdmins: true },
    }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, organizationId: true, role: true, isActive: true, adminAccessGranted: true },
    }),
  ])
  if (!org) return errorResponse('Organizasyon bulunamadı', 404)
  if (org.ownerUserId !== ownerId) {
    return errorResponse('Bu işlem yalnızca Esas Yönetici tarafından yapılabilir', 403)
  }
  if (!target || target.organizationId !== orgId) {
    return errorResponse('Personel bulunamadı', 404)
  }
  if (target.role !== 'staff') {
    return errorResponse('Bu işlem yalnızca personel hesapları için geçerlidir', 400)
  }
  return { org, target }
}

/** JWT app_metadata.admin_access'i hedefin mevcut metadata'sını KORUYARAK günceller. */
async function syncAdminAccessClaim(targetId: string, value: boolean): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    const { data, error: getErr } = await supabase.auth.admin.getUserById(targetId)
    if (getErr || !data?.user) throw getErr ?? new Error('auth user bulunamadı')
    const current = (data.user.app_metadata ?? {}) as Record<string, unknown>
    const { error: updErr } = await supabase.auth.admin.updateUserById(targetId, {
      app_metadata: { ...current, admin_access: value },
    })
    if (updErr) throw updErr
    return true
  } catch (err) {
    logger.warn('admin-access', 'app_metadata admin_access senkronu başarısız', {
      targetId,
      value,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

// ── VER ──────────────────────────────────────────────────────────────────────
export const POST = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const orgId = organizationId
  const targetId = params.id

  const res = await loadOwnerAndTarget(orgId, dbUser.id, targetId)
  if (res instanceof Response) return res
  const { org, target } = res

  if (target.adminAccessGranted) {
    return jsonResponse({ granted: true, alreadySet: true })
  }

  // Koltuk limiti — aktif admin + grant'lı staff + bekleyen admin daveti.
  const [adminCount, grantedStaffCount, pendingInvites] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'admin', isActive: true } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff', adminAccessGranted: true, isActive: true } }),
    prisma.invitation.count({
      where: { organizationId: orgId, role: 'admin', acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ])
  if (adminCount + grantedStaffCount + pendingInvites >= org.maxAdmins) {
    return errorResponse(
      `Yönetici limiti dolu (${org.maxAdmins}). Aktif yönetici: ${adminCount + grantedStaffCount}, bekleyen davet: ${pendingInvites}. Limit yükseltmek için Klinova ile iletişime geçin.`,
      409,
    )
  }

  // Önce DB, sonra JWT claim. Claim başarısızsa DB'yi geri al (grant yarım kalmasın:
  // aksi halde kişi /admin sayfalarına ulaşamaz ama DB'de yetkili görünürdü).
  await prisma.user.update({ where: { id: targetId }, data: { adminAccessGranted: true } })
  const synced = await syncAdminAccessClaim(targetId, true)
  if (!synced) {
    await prisma.user.update({ where: { id: targetId }, data: { adminAccessGranted: false } }).catch(() => {})
    return errorResponse('Yetki verilemedi (kimlik servisi güncellenemedi). Lütfen tekrar deneyin.', 500)
  }

  invalidateAuthCache(targetId)
  await audit({
    action: 'user.admin_access.grant',
    entityType: 'user',
    entityId: targetId,
    newData: { adminAccessGranted: true },
  })

  return jsonResponse({ granted: true })
}, { requireOrganization: true })

// ── KALDIR ───────────────────────────────────────────────────────────────────
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const orgId = organizationId
  const targetId = params.id

  const res = await loadOwnerAndTarget(orgId, dbUser.id, targetId)
  if (res instanceof Response) return res
  const { target } = res

  if (!target.adminAccessGranted) {
    return jsonResponse({ granted: false, alreadySet: true })
  }

  // Kaldırmada güvenlik önceliği: DB'yi HEMEN false yap (API guard'ı anında keser).
  // JWT claim senkronu best-effort; başarısızsa sayfa gate'i token yenilenene kadar sarkar
  // ama tüm /api/admin/* çağrıları zaten DB'den 403 alır.
  await prisma.user.update({ where: { id: targetId }, data: { adminAccessGranted: false } })
  await syncAdminAccessClaim(targetId, false)
  invalidateAuthCache(targetId)

  await audit({
    action: 'user.admin_access.revoke',
    entityType: 'user',
    entityId: targetId,
    newData: { adminAccessGranted: false },
  })

  return jsonResponse({ granted: false })
}, { requireOrganization: true })
