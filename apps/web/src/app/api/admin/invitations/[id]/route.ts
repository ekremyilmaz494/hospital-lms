import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * DELETE /api/admin/invitations/[id]
 *
 * Esas Yönetici bekleyen daveti iptal eder (revoke).
 * acceptedAt set olmuş bir daveti revoke etmez (zaten kullanılmış).
 */
export const DELETE = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = await params
  const orgId = organizationId

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      acceptedAt: true,
      revokedAt: true,
      email: true,
      organization: {
        select: { ownerUserId: true },
      },
    },
  })

  if (!invitation || invitation.organizationId !== orgId) {
    return errorResponse('Davet bulunamadı', 404)
  }

  if (dbUser.role !== 'super_admin' && invitation.organization.ownerUserId !== dbUser.id) {
    return errorResponse('Yalnızca Esas Yönetici daveti iptal edebilir', 403)
  }

  if (invitation.acceptedAt) {
    return errorResponse('Bu davet zaten kullanılmış, iptal edilemez', 409)
  }

  if (invitation.revokedAt) {
    return jsonResponse({ id: invitation.id, alreadyRevoked: true })
  }

  await prisma.invitation.update({
    where: { id },
    data: { revokedAt: new Date() },
  })

  await audit({
    action: 'invitation.revoke',
    entityType: 'invitation',
    entityId: invitation.id,
    newData: { email: invitation.email },
  })

  return jsonResponse({ id: invitation.id, revoked: true })
}, { requireOrganization: true })
