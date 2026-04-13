import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, requireRole } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/responses/[id]
 *
 * Tek response'un detay görünümü — tüm kategoriler + sorular + cevaplar.
 * Admin kategori bazında dolu görür (bazı itemlar eski form'dan kalmış olabilir
 * ama answer referansları FK cascade ile form değiştiğinde silineceği için
 * response gerçekten aktif form'un item'larına bağlıdır).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)
  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const response = await prisma.trainingFeedbackResponse.findFirst({
      where: { id, organizationId: dbUser.organizationId },
      select: {
        id: true,
        submittedAt: true,
        includeName: true,
        isPassed: true,
        training: { select: { id: true, title: true } },
        form: {
          select: {
            id: true,
            title: true,
            documentCode: true,
            categories: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                order: true,
                items: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    text: true,
                    questionType: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            title: true,
            departmentRel: { select: { id: true, name: true } },
          },
        },
        answers: {
          select: { itemId: true, score: true, textAnswer: true },
        },
      },
    })

    if (!response) return errorResponse('Yanıt bulunamadı', 404)

    const answerByItem = new Map(response.answers.map(a => [a.itemId, a]))

    return jsonResponse({
      id: response.id,
      submittedAt: response.submittedAt,
      isPassed: response.isPassed,
      training: response.training,
      form: {
        id: response.form.id,
        title: response.form.title,
        documentCode: response.form.documentCode,
        categories: response.form.categories.map(c => ({
          id: c.id,
          name: c.name,
          order: c.order,
          items: c.items.map(i => ({
            id: i.id,
            text: i.text,
            questionType: i.questionType,
            order: i.order,
            answer: answerByItem.get(i.id) ?? null,
          })),
        })),
      },
      participant: response.includeName && response.user
        ? {
            id: response.user.id,
            name: `${response.user.firstName} ${response.user.lastName}`.trim(),
            email: response.user.email,
            title: response.user.title,
            departmentName: response.user.departmentRel?.name ?? null,
          }
        : null,
    }, 200, {
      'Cache-Control': 'private, max-age=60',
    })
  } catch (err) {
    logger.error('AdminFeedbackResponse GET', 'Detay alınamadı', { err, userId: dbUser.id, id })
    return errorResponse('Yanıt yüklenemedi', 500)
  }
}
