import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

/** GET /api/admin/scorm — List SCORM trainings for the admin's org */
export const GET = withAdminRoute(async ({ organizationId }) => {
  try {
    const trainings = await prisma.training.findMany({
      where: {
        organizationId,
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

    return jsonResponse(trainings, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('SCORM List', 'SCORM icerikleri yuklenemedi', err)
    return errorResponse('SCORM icerikleri yuklenemedi', 503)
  }
}, { requireOrganization: true })
