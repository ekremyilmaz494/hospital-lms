import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/feedback/form
 * Auth user'ın organizasyonuna ait aktif EY.FR.40 formunu döner.
 * Kategori + item'lar ile nested select — staff dolduracağı için read-only.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const form = await prisma.trainingFeedbackForm.findFirst({
      where: { organizationId: dbUser.organizationId, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
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
                isRequired: true,
                order: true,
              },
            },
          },
        },
      },
    })

    if (!form) return jsonResponse({ form: null }, 200, {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    })

    return jsonResponse({ form }, 200, {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    })
  } catch (err) {
    logger.error('FeedbackForm GET', 'Form çekilemedi', { err, userId: dbUser.id })
    return errorResponse('Form yüklenirken bir hata oluştu', 500)
  }
}
