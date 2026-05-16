import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { trainingFeedbackFormCreateSchema } from '@/lib/validations'
import { getFeedbackFormTemplate } from '@/lib/feedback-form-templates'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/forms?archived=1
 *
 * Org'un feedback formları. Default: arşivsizler (taslak + aktif).
 * `?archived=1` query param ile arşivli liste görüntülenebilir (gelecekte UI tab).
 *
 * Cache-Control: no-store — admin mutation sonrası 30 sn stale liste flash döngüsü
 * yaratıyordu (önceki bug). Admin paneli için no-store doğru karar.
 */
export const GET = withAdminRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const url = new URL(request.url)
    const archived = url.searchParams.get('archived') === '1'

    const forms = await prisma.trainingFeedbackForm.findMany({
      where: { organizationId, isArchived: archived },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        description: true,
        documentCode: true,
        isActive: true,
        isMandatory: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { responses: true, categories: true } },
      },
    })

    return jsonResponse({ forms }, 200, { 'Cache-Control': 'private, no-store' })
  } catch (err) {
    logger.error('AdminFeedbackForms GET', 'Liste çekilemedi', { err, userId: dbUser.id })
    return errorResponse('Formlar yüklenemedi', 500)
  }
}, { requireOrganization: true })

/**
 * POST /api/admin/feedback/forms
 *
 * Yeni form taslağı yaratır. `templateKey` verilirse sistem şablonundan kopyalanır.
 * Yeni form DAİMA `isActive=false` (taslak). Şablon kategorileri `Promise.all`
 * ile paralel yaratılır (perf-check kuralı: 5+ ardışık await yasak).
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const allowed = await checkRateLimit(`feedback-form-create:${dbUser.id}`, 30, 60)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Çok fazla yeni form. Lütfen biraz bekleyin.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
    )
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek')

  const parsed = trainingFeedbackFormCreateSchema.safeParse(body)
  if (!parsed.success) return errorResponse('Form verisi geçersiz')

  const { templateKey, title: customTitle } = parsed.data
  const template = templateKey ? getFeedbackFormTemplate(templateKey) : null
  if (templateKey && !template) return errorResponse('Şablon bulunamadı', 404)

  try {
    const form = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingFeedbackForm.create({
        data: {
          organizationId,
          title: customTitle ?? template?.defaultTitle ?? 'Yeni Geri Bildirim Formu',
          description: template?.defaultDescription ?? null,
          documentCode: template?.documentCode ?? null,
          isActive: false,
        },
        select: { id: true },
      })

      if (template && template.categories.length > 0) {
        // Kategoriler bağımsız, paralel yarat — perf + tx içinde toplam round-trip azaltılır.
        await Promise.all(
          template.categories.map(cat =>
            tx.trainingFeedbackCategory.create({
              data: {
                formId: created.id,
                name: cat.name,
                order: cat.order,
                items: {
                  create: cat.items.map(i => ({
                    text: i.text,
                    questionType: i.questionType,
                    isRequired: i.isRequired,
                    order: i.order,
                  })),
                },
              },
            }),
          ),
        )
      }

      return created
    })

    await audit({
      action: 'feedback_form.created',
      entityType: 'training_feedback_form',
      entityId: form.id,
      newData: { templateKey: templateKey ?? null, title: customTitle ?? template?.defaultTitle ?? null },
    })

    return jsonResponse({ formId: form.id }, 201)
  } catch (err) {
    logger.error('AdminFeedbackForms POST', 'Oluşturulamadı', { err, userId: dbUser.id, templateKey })
    return errorResponse('Form oluşturulamadı', 500)
  }
}, { requireOrganization: true })
