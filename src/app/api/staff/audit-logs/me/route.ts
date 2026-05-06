import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/audit-logs/me
 *
 * Personelin kendi veri değişim geçmişi — KVKK şeffaflık gereği.
 * Sadece subjectId veya userId = currentUser olan kayıtlar döner.
 * Diğer kullanıcıların işlemleri kesinlikle gösterilmez.
 */
export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)

    const where = {
      userId: dbUser.id,
      organizationId,
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          ipAddress: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return jsonResponse(
      { logs, total, page, limit, totalPages: Math.ceil(total / limit) },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('StaffAuditLogsMe GET', 'Geçmiş alınamadı', { err, userId: dbUser.id })
    return errorResponse('İşlem geçmişi alınırken hata oluştu', 500)
  }
}, { requireOrganization: true })
