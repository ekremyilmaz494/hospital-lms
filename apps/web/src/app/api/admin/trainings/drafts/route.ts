import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/admin/trainings/drafts
 * Mevcut kullanıcının yarım bıraktığı taslakları listeler. Eğitimler sayfasındaki
 * "Taslaklar" sekmesi bunu çağırır. super_admin tüm orgu görmek isterse buraya
 * `?orgScope=all` eklenebilir; şu an sadece kullanıcının kendi taslakları.
 */
export const GET = withAdminRoute(async ({ dbUser, organizationId }) => {
  const drafts = await prisma.training.findMany({
    where: {
      organizationId,
      createdById: dbUser.id,
      publishStatus: 'draft',
    },
    select: {
      id: true,
      title: true,
      category: true,
      draftStep: true,
      draftUpdatedAt: true,
      updatedAt: true,
    },
    orderBy: { draftUpdatedAt: 'desc' },
  })

  const mapped = drafts.map(d => ({
    id: d.id,
    title: d.title || 'İsimsiz Taslak',
    category: d.category ?? '',
    step: d.draftStep ?? 1,
    updatedAt: (d.draftUpdatedAt ?? d.updatedAt).toISOString(),
  }))

  return jsonResponse(
    { drafts: mapped, total: mapped.length },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })
