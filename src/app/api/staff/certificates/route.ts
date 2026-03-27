import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  try {
    const certificates = await prisma.certificate.findMany({
      where: { userId: dbUser!.id },
      include: {
        training: { select: { title: true, category: true } },
        attempt: { select: { postExamScore: true, attemptNumber: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    })

    const now = new Date()

    return jsonResponse(
      certificates.map(c => ({
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
      }))
    )
  } catch (err) {
    logger.error('Staff Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}
