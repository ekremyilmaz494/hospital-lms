import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)

    const where = {
      userId: dbUser!.id,
      training: { organizationId: dbUser!.organizationId! },
    }

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        include: {
          training: { select: { title: true, category: true } },
          attempt: { select: { postExamScore: true, attemptNumber: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.certificate.count({ where }),
    ])

    const now = new Date()

    return jsonResponse({
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
        },
        score: c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0,
        attemptNumber: c.attempt.attemptNumber,
      })),
    })
  } catch (err) {
    logger.error('Staff Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}
