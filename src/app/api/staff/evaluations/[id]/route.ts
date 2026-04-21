import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/staff/evaluations/[id]
 *
 * Tek bir yetkinlik değerlendirmesini form yapısı, konu kişi ve mevcut
 * cevaplarla birlikte döner. Sadece evaluator (değerlendirmeyi yapan kişi)
 * kendi org'u içinde erişebilir — tenant izolasyonu form.organizationId ile.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const { id } = await params

  try {
    const evaluation = await prisma.competencyEvaluation.findFirst({
      where: {
        id,
        evaluatorId: dbUser!.id,
        form: { organizationId: dbUser!.organizationId! },
      },
      select: {
        id: true,
        status: true,
        evaluatorType: true,
        form: {
          select: {
            id: true,
            title: true,
            categories: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                name: true,
                weight: true,
                order: true,
                items: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, description: true, order: true },
                },
              },
            },
          },
        },
        subject: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
            departmentRel: { select: { name: true } },
          },
        },
        answers: {
          select: { itemId: true, score: true, comment: true },
        },
      },
    })

    if (!evaluation) {
      return errorResponse('Değerlendirme bulunamadı.', 404)
    }

    const totalItems = evaluation.form.categories.reduce((sum, c) => sum + c.items.length, 0)
    const answeredItems = evaluation.answers.length
    const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0

    return jsonResponse(
      { evaluation, totalItems, answeredItems, progress },
      200,
      { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' }
    )
  } catch (err) {
    logger.error('staff:evaluations:[id]', 'Değerlendirme alınamadı', err)
    return errorResponse('Değerlendirme alınamadı.', 500)
  }
}
