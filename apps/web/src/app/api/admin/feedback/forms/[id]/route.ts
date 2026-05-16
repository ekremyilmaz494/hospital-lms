import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { trainingFeedbackFormUpsertSchema } from '@/lib/validations'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/forms/[id]
 * Form detayı (kategoriler + item'lar). Org sahipliği zorlanır.
 * Cache: no-store — admin için taze veri.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id } = params
  try {
    const form = await prisma.trainingFeedbackForm.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        documentCode: true,
        isActive: true,
        isMandatory: true,
        isArchived: true,
        updatedAt: true,
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
        _count: { select: { responses: true } },
      },
    })

    if (!form) return errorResponse('Form bulunamadı', 404)

    return jsonResponse({ form }, 200, { 'Cache-Control': 'private, no-store' })
  } catch (err) {
    logger.error('AdminFeedbackForm GET', 'Detay çekilemedi', { err, userId: dbUser.id, id })
    return errorResponse('Form yüklenemedi', 500)
  }
}, { requireOrganization: true })

/**
 * PUT /api/admin/feedback/forms/[id]
 *
 * Smart-merge update: id'liyi update, yeniyi create, listede olmayanı delete.
 * `TrainingFeedbackResponse.formId`/`Answer.itemId` FK'leri kırılmaz —
 * geçmiş raporlar bozulmaz.
 *
 * Aktif form düzenlenebilir AMA isMandatory değişikliği aktif formda otomatik
 * olarak Training'lere yansımaz. Admin'in `activate` butonuna tekrar basması
 * gerekir (UI yönlendirmesi). Bu kasıtlı: PUT içerik düzenleme, atama ayrı bir
 * eylem.
 */
export const PUT = withAdminRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId, audit }) => {
    const { id } = params

    const allowed = await checkRateLimit(`feedback-form-edit:${dbUser.id}`, 60, 60)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Çok hızlı düzenleme. Birazdan tekrar deneyin.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }

    const body = await parseBody(request)
    if (!body) return errorResponse('Geçersiz istek')

    const parsed = trainingFeedbackFormUpsertSchema.safeParse(body)
    if (!parsed.success) {
      logger.error('AdminFeedbackForm PUT', 'Validasyon hatası', { issues: parsed.error.issues })
      return errorResponse('Form verisi geçersiz')
    }

    const data = parsed.data

    try {
      // Tüm işi tek transaction'da: ownership + update + smart-merge.
      // Ownership check transaction İÇİNDE → TOCTOU yok.
      await prisma.$transaction(async (tx) => {
        const owned = await tx.trainingFeedbackForm.findFirst({
          where: { id, organizationId, isArchived: false },
          select: { id: true },
        })
        if (!owned) throw new NotFoundError()

        await tx.trainingFeedbackForm.update({
          where: { id },
          data: {
            title: data.title,
            description: data.description ?? null,
            documentCode: data.documentCode ?? null,
            isMandatory: data.isMandatory,
          },
        })

        const existing = await tx.trainingFeedbackCategory.findMany({
          where: { formId: id },
          select: { id: true, items: { select: { id: true } } },
        })
        const existingCatIds = new Set(existing.map(c => c.id))
        const existingItemIds = new Set(existing.flatMap(c => c.items.map(i => i.id)))

        const keepCatIds = new Set<string>()
        const keepItemIds = new Set<string>()
        for (const cat of data.categories) {
          if (cat.id && existingCatIds.has(cat.id)) keepCatIds.add(cat.id)
          for (const item of cat.items) {
            if (item.id && existingItemIds.has(item.id)) keepItemIds.add(item.id)
          }
        }

        const catIdsToDelete = [...existingCatIds].filter(x => !keepCatIds.has(x))
        if (catIdsToDelete.length > 0) {
          await tx.trainingFeedbackCategory.deleteMany({ where: { id: { in: catIdsToDelete } } })
        }
        const itemIdsToDelete = [...existingItemIds].filter(x => !keepItemIds.has(x))
        if (itemIdsToDelete.length > 0) {
          await tx.trainingFeedbackItem.deleteMany({ where: { id: { in: itemIdsToDelete } } })
        }

        for (let ci = 0; ci < data.categories.length; ci++) {
          const cat = data.categories[ci]
          const catId = cat.id && existingCatIds.has(cat.id) ? cat.id : undefined

          const savedCat = catId
            ? await tx.trainingFeedbackCategory.update({
                where: { id: catId },
                data: { name: cat.name, order: cat.order ?? ci },
                select: { id: true },
              })
            : await tx.trainingFeedbackCategory.create({
                data: { formId: id, name: cat.name, order: cat.order ?? ci },
                select: { id: true },
              })

          for (let ii = 0; ii < cat.items.length; ii++) {
            const item = cat.items[ii]
            const itemId = item.id && existingItemIds.has(item.id) ? item.id : undefined

            if (itemId) {
              await tx.trainingFeedbackItem.update({
                where: { id: itemId },
                data: {
                  text: item.text,
                  questionType: item.questionType,
                  isRequired: item.isRequired,
                  order: item.order ?? ii,
                  categoryId: savedCat.id,
                },
              })
            } else {
              await tx.trainingFeedbackItem.create({
                data: {
                  categoryId: savedCat.id,
                  text: item.text,
                  questionType: item.questionType,
                  isRequired: item.isRequired,
                  order: item.order ?? ii,
                },
              })
            }
          }
        }
      })

      await audit({
        action: 'feedback_form.updated',
        entityType: 'training_feedback_form',
        entityId: id,
        newData: { title: data.title, categoryCount: data.categories.length },
      })

      return jsonResponse({ success: true, formId: id })
    } catch (err) {
      if (err instanceof NotFoundError) return errorResponse('Form bulunamadı', 404)
      logger.error('AdminFeedbackForm PUT', 'Güncelleme hatası', { err, userId: dbUser.id, id })
      return errorResponse('Form güncellenirken hata oluştu', 500)
    }
  },
  { requireOrganization: true },
)

/**
 * DELETE /api/admin/feedback/forms/[id]
 *
 * Form silme. Yanıt varsa silmek yerine ARŞİVLE (`isArchived=true`) — yanıt
 * geçmişi FK ile korunur, admin liste UI'sından gizlenir.
 *
 * Aktif formu silmek/arşivlemek yasak; önce başka bir formu aktive et.
 *
 * deleteMany ile race-safe: P2025 yerine count=0 → ayrı 404 mesajı.
 */
export const DELETE = withAdminRoute<{ id: string }>(
  async ({ params, dbUser, organizationId, audit }) => {
    const { id } = params

    const allowed = await checkRateLimit(`feedback-form-delete:${dbUser.id}`, 30, 60)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Çok hızlı silme/arşivleme. Birazdan tekrar deneyin.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }

    try {
      const form = await prisma.trainingFeedbackForm.findFirst({
        where: { id, organizationId },
        select: { id: true, title: true, isActive: true, isArchived: true, _count: { select: { responses: true } } },
      })
      if (!form) return errorResponse('Form bulunamadı', 404)
      if (form.isActive) {
        return errorResponse('Aktif form silinemez. Önce başka bir formu aktive et.', 409)
      }

      // Yanıt yoksa hard delete; varsa arşive al (FK korunur).
      if (form._count.responses === 0) {
        const result = await prisma.trainingFeedbackForm.deleteMany({
          where: { id, organizationId, isActive: false },
        })
        if (result.count === 0) {
          return errorResponse(
            'Form silinmiş veya başka bir admin tarafından aktive edilmiş. Sayfayı yenile.',
            409,
          )
        }
        await audit({
          action: 'feedback_form.deleted',
          entityType: 'training_feedback_form',
          entityId: id,
          oldData: { title: form.title },
        })
        return jsonResponse({ success: true, archived: false })
      } else {
        if (form.isArchived) {
          return errorResponse('Form zaten arşivli', 409)
        }
        await prisma.trainingFeedbackForm.update({
          where: { id },
          data: { isArchived: true },
        })
        await audit({
          action: 'feedback_form.archived',
          entityType: 'training_feedback_form',
          entityId: id,
          newData: { title: form.title, responseCount: form._count.responses },
        })
        return jsonResponse({
          success: true,
          archived: true,
          message: `Form arşivlendi (${form._count.responses} yanıt geçmişi korundu).`,
        })
      }
    } catch (err) {
      logger.error('AdminFeedbackForm DELETE', 'Silinemedi', { err, userId: dbUser.id, id })
      return errorResponse('Form silinemedi', 500)
    }
  },
  { requireOrganization: true },
)

class NotFoundError extends Error {}
