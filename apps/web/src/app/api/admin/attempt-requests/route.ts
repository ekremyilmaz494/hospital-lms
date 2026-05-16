import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/** GET /api/admin/attempt-requests?status=pending&page=1&limit=20&trainingId=...
 *  Kuruma ait ek hak taleplerini sayfalı listele */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') ?? 'pending'
  const validStatuses = ['pending', 'approved', 'rejected', 'all']
  if (!validStatuses.includes(statusFilter)) {
    return errorResponse('Geçersiz durum filtresi', 400)
  }

  const trainingIdFilter = url.searchParams.get('trainingId')
  if (trainingIdFilter && !/^[0-9a-f-]{36}$/i.test(trainingIdFilter)) {
    return errorResponse('Geçersiz eğitim kimliği', 400)
  }

  const { page, limit, skip } = safePagination(url.searchParams)

  const where = {
    organizationId,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(trainingIdFilter && { trainingId: trainingIdFilter }),
  }

  try {
    const [total, requests] = await Promise.all([
      prisma.examAttemptRequest.count({ where }),
      prisma.examAttemptRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          reason: true,
          grantedAttempts: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
          trainingId: true,
          userId: true,
          training: { select: { title: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              departmentRel: { select: { name: true } },
            },
          },
          reviewedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ])

    // Sayfa içindeki taleplerin atama durumunu tek sorguda getir.
    // OR listesi yerine `userId IN (...) AND trainingId IN (...)` ile sorgula,
    // sonra JS map ile (userId, trainingId) çiftine eşleştir. Bu yaklaşım,
    // false-positive eşleşmelere izin verir (ör. user A'nın training B atamasını da çeker)
    // ama sayfa boyutu sınırlı (≤100) olduğundan toplam sonuç küçük kalır.
    const userIds = Array.from(new Set(requests.map((r) => r.userId)))
    const trainingIds = Array.from(new Set(requests.map((r) => r.trainingId)))

    const assignments =
      userIds.length > 0 && trainingIds.length > 0
        ? await prisma.trainingAssignment.findMany({
            where: {
              userId: { in: userIds },
              trainingId: { in: trainingIds },
            },
            select: {
              userId: true,
              trainingId: true,
              currentAttempt: true,
              maxAttempts: true,
              status: true,
            },
          })
        : []

    const assignmentMap = new Map(
      assignments.map((a) => [`${a.userId}:${a.trainingId}`, a]),
    )

    const enriched = requests.map((r) => ({
      ...r,
      assignment: assignmentMap.get(`${r.userId}:${r.trainingId}`) ?? null,
    }))

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return jsonResponse(
      { items: enriched, total, page, limit, totalPages },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('AdminAttemptRequests', 'Talepler listelenemedi', err)
    return errorResponse('Talepler yüklenirken hata oluştu', 500)
  }
}, { requireOrganization: true })
