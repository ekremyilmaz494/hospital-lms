import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { withCache } from '@/lib/redis'
import { isTrainingAccessible } from '@/lib/training-helpers'

export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)
    const orgId = organizationId
    const userId = dbUser.id
    const cacheKey = `cache:${orgId}:certs:${userId}:${page}:${limit}`

    const data = await withCache(cacheKey, 600, async () => {
      const where = {
        userId,
        training: { organizationId: orgId },
      }

      const [certificates, total] = await Promise.all([
        prisma.certificate.findMany({
          where,
          include: {
            training: { select: { title: true, category: true, isActive: true, publishStatus: true } },
            attempt: { select: { postExamScore: true, attemptNumber: true } },
          },
          orderBy: { issuedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.certificate.count({ where }),
      ])

      const now = new Date()

      return {
        total,
        page,
        limit,
        certificates: certificates.map(c => ({
          id: c.id,
          certificateCode: c.certificateCode,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isExpired: c.expiresAt ? new Date(c.expiresAt) < now : false,
          training: {
            title: c.training.title,
            category: c.training.category ?? '',
            isArchived: !isTrainingAccessible(c.training),
          },
          score: c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0,
          attemptNumber: c.attempt.attemptNumber,
        })),
      }
    })

    return jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  } catch (err) {
    logger.error('Staff Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}, { requireOrganization: true })
