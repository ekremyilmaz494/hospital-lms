import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkFeature } from '@/lib/feature-gate'
import { SCORM_FEATURE_DISABLED_MSG } from '@/lib/scorm/config'
import { logger } from '@/lib/logger'

/** GET /api/admin/scorm — List SCORM trainings for the admin's org */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const enabled = await checkFeature(organizationId, 'scormSupport')
  if (!enabled) return errorResponse(SCORM_FEATURE_DISABLED_MSG, 403)

  try {
    const trainings = await prisma.training.findMany({
      where: {
        organizationId,
        category: 'scorm',
        publishStatus: { not: 'archived' },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        scormVersion: true,
        scormEntryPoint: true,
        isActive: true,
        publishStatus: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        _count: { select: { assignments: true, scormAttempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse(trainings, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('SCORM List', 'SCORM icerikleri yuklenemedi', err)
    return errorResponse('SCORM icerikleri yuklenemedi', 503)
  }
}, { requireOrganization: true })
