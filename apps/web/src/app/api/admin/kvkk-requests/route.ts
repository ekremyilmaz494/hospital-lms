import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/** GET /api/admin/kvkk-requests?status=pending&page=1&limit=20
 *  Kuruma ait KVKK hak taleplerini sayfalı listele (admin yanıt paneli).
 *  Personel talep açar ama yanıtı yalnız admin bu uçtan görüp yazabilir (KVKK m.13 — 30 gün). */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') ?? 'pending'
  const validStatuses = ['pending', 'in_progress', 'completed', 'rejected', 'all']
  if (!validStatuses.includes(statusFilter)) {
    return errorResponse('Geçersiz durum filtresi', 400)
  }

  const { page, limit, skip } = safePagination(url.searchParams)

  const where = {
    organizationId,
    ...(statusFilter !== 'all' && { status: statusFilter }),
  }

  try {
    const [total, pendingCount, requests] = await Promise.all([
      prisma.kvkkRequest.count({ where }),
      prisma.kvkkRequest.count({ where: { organizationId, status: 'pending' } }),
      prisma.kvkkRequest.findMany({
        where,
        // Bekleyenler önce, sonra en yeni
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          requestType: true,
          status: true,
          description: true,
          responseNote: true,
          createdAt: true,
          completedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              departmentRel: { select: { name: true } },
            },
          },
          respondedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return jsonResponse(
      { items: requests, total, pendingCount, page, limit, totalPages },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('AdminKvkkRequests', 'Talepler listelenemedi', err)
    return errorResponse('Talepler yüklenirken hata oluştu', 500)
  }
}, { requireOrganization: true })
