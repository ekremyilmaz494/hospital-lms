import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/** GET /api/admin/scorm — List SCORM trainings for the admin's org */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) {
    return errorResponse('Organizasyon bulunamadı', 403)
  }

  try {
    const trainings = await prisma.training.findMany({
      where: {
        organizationId: dbUser!.organizationId!,
        category: 'scorm',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        thumbnailUrl: true,
        isActive: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse(trainings)
  } catch (err) {
    logger.error('SCORM List', 'SCORM icerikleri yuklenemedi', err)
    return errorResponse('SCORM icerikleri yuklenemedi', 503)
  }
}
