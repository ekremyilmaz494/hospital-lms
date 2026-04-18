import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { withCache } from '@/lib/redis'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)
    const orgId = dbUser!.organizationId!
    const userId = dbUser!.id
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
            isArchived: !c.training.isActive || c.training.publishStatus === 'archived',
          },
          score: c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0,
          attemptNumber: c.attempt.attemptNumber,
        })),
      }
    })

    return jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Staff Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}
