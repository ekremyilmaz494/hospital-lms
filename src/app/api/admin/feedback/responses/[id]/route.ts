import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { calculateOverallScore, type FeedbackQuestionType } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/responses/[id]
 *
 * Tek response'un detay görünümü — tüm kategoriler + sorular + cevaplar.
 *
 * Tarihsel bütünlük:
 *  - response.formSnapshot varsa (yeni kayıtlar) form yapısı oradan çözülür.
 *    Admin sonradan item sildiyse bile orijinal soru metni korunur.
 *  - Snapshot yoksa (eski kayıtlar, snapshot migration öncesi) live form'a
 *    fallback — silinmiş itemlar "—" görülür ama crash olmaz.
 *
 * overallScore server-side hesaplanır — listedeki `calculateOverallScore` ile
 * aynı rounding kullanılır (client'ta sapma olmasın).
 */
type SnapshotItem = {
  id: string
  text: string
  questionType: string
  order?: number
  isRequired?: boolean
}
type SnapshotCategory = {
  id: string
  name: string
  order: number
  items: SnapshotItem[]
}
type FormSnapshot = {
  title: string
  description?: string | null
  documentCode?: string | null
  categories: SnapshotCategory[]
}
type AnswerItemSnapshot = {
  text: string
  questionType: string
  categoryId?: string
  categoryName?: string
  categoryOrder?: number
  order?: number
}

export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params

  try {
    const response = await prisma.trainingFeedbackResponse.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        submittedAt: true,
        includeName: true,
        isPassed: true,
        formSnapshot: true,
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
          select: {
            itemId: true,
            itemSnapshot: true,
            score: true,
            textAnswer: true,
          },
        },
      },
    })

    if (!response) return errorResponse('Yanıt bulunamadı', 404)

    // Snapshot öncelikli: admin sonradan form'u değiştirmiş olsa bile orijinal
    // soru metnini koruruz. Snapshot yoksa (eski kayıtlar) live form'a düş.
    const snapshot = response.formSnapshot as FormSnapshot | null
    const sourceForm = snapshot
      ? {
          id: response.form.id,
          title: snapshot.title,
          documentCode: snapshot.documentCode ?? response.form.documentCode,
          categories: snapshot.categories,
        }
      : {
          id: response.form.id,
          title: response.form.title,
          documentCode: response.form.documentCode,
          categories: response.form.categories,
        }

    // Answer map: itemId null olabilir (item silinmiş, SetNull), bu durumda
    // snapshot içindeki item.id ile eşleşme eski itemId üzerinden yapılır.
    const answerByItem = new Map(
      response.answers
        .filter(a => a.itemId !== null)
        .map(a => [a.itemId as string, a]),
    )

    // Genel puan — liste endpoint'i ile aynı helper (rounding tutarlı)
    const overallScore = calculateOverallScore(
      response.answers.map(a => {
        const snap = a.itemSnapshot as AnswerItemSnapshot | null
        return {
          score: a.score,
          questionType: (snap?.questionType ?? 'text') as FeedbackQuestionType,
        }
      }),
    )

    return jsonResponse({
      id: response.id,
      submittedAt: response.submittedAt,
      isPassed: response.isPassed,
      overallScore,
      training: response.training,
      form: {
        id: sourceForm.id,
        title: sourceForm.title,
        documentCode: sourceForm.documentCode,
        categories: sourceForm.categories.map(c => ({
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
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    })
  } catch (err) {
    logger.error('AdminFeedbackResponse GET', 'Detay alınamadı', { err, userId: dbUser.id, id })
    return errorResponse('Yanıt yüklenemedi', 500)
  }
}, { requireOrganization: true })
