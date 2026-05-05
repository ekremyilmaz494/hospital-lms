import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/admin/invitations
 *
 * Esas Yönetici (org owner) bekleyen davetleri görüntüler.
 * Sıradan admin'ler 403.
 */
export const GET = withAdminRoute(async ({ dbUser, organizationId }) => {
  const orgId = organizationId

  // Owner kontrolü
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerUserId: true },
  })
  if (!org) return errorResponse('Organizasyon bulunamadı', 404)

  // super_admin tüm orgların davetini görebilir, normal admin sadece owner ise
  if (dbUser.role !== 'super_admin' && org.ownerUserId !== dbUser.id) {
    return errorResponse('Bu listeye yalnızca Esas Yönetici erişebilir', 403)
  }

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: orgId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      title: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse(
    { invitations },
    200,
    {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  )
}, { requireOrganization: true })
