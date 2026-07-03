import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, invalidateAuthCache } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { revokeAllUserSessions } from '@/lib/auth/revoke-user-sessions'
import { resolveAdminStatusChange } from '@/lib/admin/admin-status'

/**
 * DELETE / POST /api/admin/users/[id]/status
 *
 * Esas Yönetici (org owner) bir GERÇEK yöneticiyi (rol='admin') pasife alır / aktifleştirir.
 *   - DELETE → pasife al (isActive=false): giriş engellenir, koltuk boşalır, oturum iptal edilir.
 *   - POST   → aktifleştir (isActive=true): koltuk limiti müsaitse hesap tekrar açılır.
 *
 * Yetki verilmiş personelin (rol='staff') yöneticiliğini kaldırmak için bu DEĞİL,
 * `DELETE /api/admin/staff/[id]/admin-access` kullanılır (kişi düz personele döner).
 *
 * KURALLAR (tek kaynak: resolveAdminStatusChange):
 *   - Yalnız Esas Yönetici. Sıradan admin 403.
 *   - Hedef aynı org'da, rol='admin', Esas Yönetici'nin kendisi DEĞİL. super_admin/staff reddedilir.
 *   - Aktifleştirmede koltuk limiti (maxAdmins) zorlanır (gelir koruması — invite/grant ile aynı).
 */

type OrgInfo = { ownerUserId: string | null; maxAdmins: number }
type TargetInfo = { id: string; organizationId: string | null; role: string; isActive: boolean }

async function loadOrgAndTarget(orgId: string, targetId: string): Promise<{ org: OrgInfo | null; target: TargetInfo | null }> {
  const [org, target] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { ownerUserId: true, maxAdmins: true } }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, organizationId: true, role: true, isActive: true },
    }),
  ])
  return { org, target }
}

// ── PASİFE AL ──────────────────────────────────────────────────────────────
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const targetId = params.id
  const { org, target } = await loadOrgAndTarget(organizationId, targetId)

  const decision = resolveAdminStatusChange({
    target,
    orgId: organizationId,
    ownerUserId: org?.ownerUserId ?? null,
    requesterId: dbUser.id,
    action: 'deactivate',
  })
  if (!decision.ok) return errorResponse(decision.message, decision.status)

  await prisma.user.update({ where: { id: targetId }, data: { isActive: false } })
  // Aktif oturumu ANINDA öldür: auth cache (per-request isActive kontrolü) + refresh token'lar.
  invalidateAuthCache(targetId)
  await revokeAllUserSessions(targetId)

  await audit({
    action: 'user.admin.deactivate',
    entityType: 'user',
    entityId: targetId,
    newData: { isActive: false },
  })

  return jsonResponse({ ok: true, isActive: false })
}, { requireOrganization: true })

// ── AKTİFLEŞTİR ────────────────────────────────────────────────────────────
export const POST = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const targetId = params.id
  const { org, target } = await loadOrgAndTarget(organizationId, targetId)

  const decision = resolveAdminStatusChange({
    target,
    orgId: organizationId,
    ownerUserId: org?.ownerUserId ?? null,
    requesterId: dbUser.id,
    action: 'reactivate',
  })
  if (!decision.ok) return errorResponse(decision.message, decision.status)

  // Koltuk limiti: aktif admin + grant'lı personel + bekleyen davet (grant endpoint ile aynı).
  const maxAdmins = org?.maxAdmins ?? 5
  const [adminCount, grantedStaffCount, pendingInvites] = await Promise.all([
    prisma.user.count({ where: { organizationId, role: 'admin', isActive: true } }),
    prisma.user.count({ where: { organizationId, role: 'staff', adminAccessGranted: true, isActive: true } }),
    prisma.invitation.count({
      where: { organizationId, role: 'admin', acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ])
  if (adminCount + grantedStaffCount + pendingInvites >= maxAdmins) {
    return errorResponse(
      `Yönetici limiti dolu (${maxAdmins}). Aktifleştirmeden önce bir yöneticiyi pasife alın veya limit yükseltmek için Klinova ile iletişime geçin.`,
      409,
    )
  }

  await prisma.user.update({ where: { id: targetId }, data: { isActive: true } })
  invalidateAuthCache(targetId)

  await audit({
    action: 'user.admin.reactivate',
    entityType: 'user',
    entityId: targetId,
    newData: { isActive: true },
  })

  return jsonResponse({ ok: true, isActive: true })
}, { requireOrganization: true })
