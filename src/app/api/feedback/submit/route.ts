import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { trainingFeedbackSubmitSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/redis'
import { isValidAnswer } from '@/lib/feedback-helpers'
import { logger } from '@/lib/logger'

/**
 * POST /api/feedback/submit
 *
 * Staff EY.FR.40 formunu doldurup gönderir. ExamAttempt başına tek response.
 * Idempotent: attempt için zaten response varsa 409 döner.
 * includeName=true ise userId kaydedilir (ISO belgesindeki "isteğe bağlı" isim).
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  // Rate limit: dakikada 10 gönderim
  const allowed = await checkRateLimit(`feedback-submit:${dbUser.id}`, 10, 60)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Çok fazla gönderim. Lütfen birazdan tekrar deneyin.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    )
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek')

  const parsed = trainingFeedbackSubmitSchema.safeParse(body)
  if (!parsed.success) {
    logger.error('FeedbackSubmit', 'Validasyon hatası', { issues: parsed.error.issues })
    return errorResponse('Form verisi geçersiz')
  }
  const { attemptId, includeName, answers } = parsed.data

  // Attempt org + user sahipliği kontrolü + completed olmalı
  const attempt = await prisma.examAttempt.findFirst({
    where: {
      id: attemptId,
      userId: dbUser.id,
      training: { organizationId: dbUser.organizationId },
    },
    select: {
      id: true,
      status: true,
      isPassed: true,
      trainingId: true,
      training: {
        select: {
          organizationId: true,
          isActive: true,
          publishStatus: true,
        },
      },
      feedbackResponse: { select: { id: true } },
    },
  })

  if (!attempt) return errorResponse('Sınav denemesi bulunamadı', 404)
  if (attempt.status !== 'completed') return errorResponse('Önce sınavı tamamlamalısınız', 400)
  if (attempt.feedbackResponse) return errorResponse('Bu sınav için zaten geri bildirim gönderdiniz', 409)
  // Archived/pasif eğitime feedback yasak — eski attempt'ler için bile. Exam akışı
  // zaten engelliyor ama savunmacı kat: doğrudan POST edilirse yakalanır.
  if (!attempt.training.isActive || attempt.training.publishStatus === 'archived') {
    return errorResponse('Bu eğitim artık aktif değil, geri bildirim kabul edilmiyor', 400)
  }

  // Kullanıcı+training bazlı idempotency: aynı eğitim için ikinci feedback engellenir.
  // attempt.userId üzerinden bağlıyoruz — anonim (userId=null) kayıtlar da yakalanır.
  const priorResponse = await prisma.trainingFeedbackResponse.findFirst({
    where: {
      trainingId: attempt.trainingId,
      attempt: { userId: dbUser.id },
    },
    select: { id: true },
  })
  if (priorResponse) return errorResponse('Bu eğitim için zaten geri bildirim gönderdiniz', 409)

  // Aktif form + tüm item'ları çek — validation + snapshot için.
  // Snapshot: submit anındaki form yapısı donmuş olarak response'a yazılır,
  // admin sonradan form'u düzenlese bile detay sayfası orijinal soruyu gösterir.
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

  if (!form) return errorResponse('Aktif geri bildirim formu bulunamadı', 404)

  const allItems = form.categories.flatMap(c => c.items)
  const itemMap = new Map(allItems.map(i => [i.id, i]))

  // Her item için hangi kategoriye ait olduğunu bilmek gerek (itemSnapshot için)
  const itemCategoryMap = new Map<string, { categoryId: string; categoryName: string; categoryOrder: number }>()
  for (const cat of form.categories) {
    for (const item of cat.items) {
      itemCategoryMap.set(item.id, { categoryId: cat.id, categoryName: cat.name, categoryOrder: cat.order })
    }
  }

  // Form snapshot — response.formSnapshot olarak yazılır
  const formSnapshot = {
    title: form.title,
    description: form.description,
    documentCode: form.documentCode,
    categories: form.categories.map(c => ({
      id: c.id,
      name: c.name,
      order: c.order,
      items: c.items.map(i => ({
        id: i.id,
        text: i.text,
        questionType: i.questionType,
        isRequired: i.isRequired,
        order: i.order,
      })),
    })),
  }

  // İki yönlü validasyon:
  // 1) Gönderilen itemId'ler formdan mı?
  // 2) Zorunlu item'lar eksik mi?
  // 3) Her cevap soru tipine uygun mu?
  const answerMap = new Map<string, (typeof answers)[number]>()
  for (const a of answers) {
    const item = itemMap.get(a.itemId)
    if (!item) return errorResponse('Geçersiz soru referansı', 400)
    if (!isValidAnswer(item.questionType as 'likert_5' | 'yes_partial_no' | 'text', item.isRequired, a)) {
      return errorResponse('Cevap formatı geçersiz', 400)
    }
    answerMap.set(a.itemId, a)
  }

  for (const item of allItems) {
    if (item.isRequired && !answerMap.has(item.id)) {
      return errorResponse('Zorunlu sorular eksik cevaplandı', 400)
    }
  }

  // Transaction: response + answer'lar
  try {
    const response = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingFeedbackResponse.create({
        data: {
          formId: form.id,
          attemptId: attempt.id,
          trainingId: attempt.trainingId,
          organizationId: attempt.training.organizationId,
          userId: includeName ? dbUser.id : null,
          includeName,
          isPassed: attempt.isPassed,
          formSnapshot,
          answers: {
            create: answers.map(a => {
              const item = itemMap.get(a.itemId)!
              const cat = itemCategoryMap.get(a.itemId)!
              return {
                itemId: a.itemId,
                itemSnapshot: {
                  text: item.text,
                  questionType: item.questionType,
                  isRequired: item.isRequired,
                  order: item.order,
                  categoryId: cat.categoryId,
                  categoryName: cat.categoryName,
                  categoryOrder: cat.categoryOrder,
                },
                score: typeof a.score === 'number' ? a.score : null,
                textAnswer: a.textAnswer ?? null,
              }
            }),
          },
        },
        select: { id: true, submittedAt: true },
      })
      return created
    })

    await createAuditLog({
      userId: dbUser.id,
      organizationId: attempt.training.organizationId,
      action: 'feedback.submitted',
      entityType: 'training_feedback_response',
      entityId: response.id,
      newData: { attemptId: attempt.id, trainingId: attempt.trainingId, includeName },
    })

    return jsonResponse({ success: true, responseId: response.id, submittedAt: response.submittedAt })
  } catch (err) {
    // Unique constraint (attempt_id): ikinci submit yarışı yakalanır
    if ((err as { code?: string })?.code === 'P2002') {
      return errorResponse('Bu sınav için zaten geri bildirim gönderilmiş', 409)
    }
    logger.error('FeedbackSubmit', 'Kayıt oluşturulamadı', { err, userId: dbUser.id, attemptId })
    return errorResponse('Geri bildirim kaydedilemedi', 500)
  }
}
