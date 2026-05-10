import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/feedback/forms/[id]/restore
 *
 * Arşivli formu geri al (isArchived=false). Aktivasyon ayrı eylem.
 */
export const POST = withAdminRoute<{ id: string }>(
  async ({ params, dbUser, organizationId, audit }) => {
    const { id } = params

    const allowed = await checkRateLimit(`feedback-form-restore:${dbUser.id}`, 30, 60)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Çok hızlı işlem. Birazdan tekrar deneyin.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }

    try {
      const result = await prisma.trainingFeedbackForm.updateMany({
        where: { id, organizationId, isArchived: true },
        data: { isArchived: false },
      })
      if (result.count === 0) {
        return errorResponse('Arşivli form bulunamadı', 404)
      }

      await audit({
        action: 'feedback_form.restored',
        entityType: 'training_feedback_form',
        entityId: id,
        newData: {},
      })

      return jsonResponse({ success: true })
    } catch (err) {
      logger.error('AdminFeedbackForm RESTORE', 'Geri alınamadı', { err, userId: dbUser.id, id })
      return errorResponse('Form geri alınamadı', 500)
    }
  },
  { requireOrganization: true },
)
