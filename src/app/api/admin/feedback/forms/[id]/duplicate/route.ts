import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/feedback/forms/[id]/duplicate
 *
 * Tek transaction: kaynak form + kategorileri + item'larını okur, isActive=false
 * yeni form olarak kopyalar. Daha önceki UI-tarafı POST+PUT yaklaşımı atomik
 * değildi; PUT fail olursa orphan boş form kalıyordu. Bu endpoint bunu çözer.
 *
 * Org isolation: kaynak ve kopya aynı orgda olmak zorunda (where filter).
 */
export const POST = withAdminRoute<{ id: string }>(
  async ({ params, dbUser, organizationId, audit }) => {
    const { id } = params

    const allowed = await checkRateLimit(`feedback-form-duplicate:${dbUser.id}`, 30, 60)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Çok fazla kopyalama. Birazdan tekrar deneyin.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }

    try {
      const newId = await prisma.$transaction(async (tx) => {
        const src = await tx.trainingFeedbackForm.findFirst({
          where: { id, organizationId },
          select: {
            title: true,
            description: true,
            documentCode: true,
            isMandatory: true,
            categories: {
              orderBy: { order: 'asc' },
              select: {
                name: true, order: true,
                items: {
                  orderBy: { order: 'asc' },
                  select: {
                    text: true, questionType: true, isRequired: true, order: true,
                  },
                },
              },
            },
          },
        })
        if (!src) throw new NotFoundError()

        const created = await tx.trainingFeedbackForm.create({
          data: {
            organizationId,
            title: `${src.title} (kopya)`,
            description: src.description,
            documentCode: src.documentCode,
            isMandatory: src.isMandatory,
            isActive: false,
            isArchived: false,
          },
          select: { id: true },
        })

        if (src.categories.length > 0) {
          await Promise.all(
            src.categories.map(cat =>
              tx.trainingFeedbackCategory.create({
                data: {
                  formId: created.id,
                  name: cat.name,
                  order: cat.order,
                  items: { create: cat.items },
                },
              }),
            ),
          )
        }

        return created.id
      })

      await audit({
        action: 'feedback_form.duplicated',
        entityType: 'training_feedback_form',
        entityId: newId,
        newData: { sourceId: id },
      })

      return jsonResponse({ formId: newId }, 201)
    } catch (err) {
      if (err instanceof NotFoundError) return errorResponse('Kaynak form bulunamadı', 404)
      logger.error('AdminFeedbackForm DUPLICATE', 'Kopyalanamadı', { err, userId: dbUser.id, id })
      return errorResponse('Form kopyalanamadı', 500)
    }
  },
  { requireOrganization: true },
)

class NotFoundError extends Error {}
