import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/admin/users
 *
 * Org'un admin listesi + Esas Yönetici bilgisi + admin sayım/limit.
 * /admin/yoneticiler sayfası kullanır.
 *
 * Erişim: tüm admin'ler okuyabilir (kim Esas Yönetici görebilsin diye).
 * Davet etme yetkisi yalnız `ownerUserId === currentUserId` olan user'da.
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const orgId = organizationId

  const [org, admins] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { ownerUserId: true, maxAdmins: true },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'admin' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        title: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const ownerUserId = org?.ownerUserId ?? null
  const maxAdmins = org?.maxAdmins ?? 5
  const activeAdminCount = admins.filter(a => a.isActive).length

  return jsonResponse(
    {
      ownerUserId,
      maxAdmins,
      activeAdminCount,
      admins: admins.map(a => ({
        ...a,
        isOwner: a.id === ownerUserId,
      })),
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })
