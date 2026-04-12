import { prisma } from '@/lib/prisma'
import { getAuthUser, jsonResponse, errorResponse, parseBody, requireRole, createAuditLog } from '@/lib/api-helpers'
import { trainingFeedbackFormUpsertSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/feedback/form
 * Organizasyonun EY.FR.40 formunu (kategoriler + itemlar ile) döner — editör için.
 * Form yoksa null döner; UI "Varsayılanı oluştur" butonu gösterir.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)
  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const form = await prisma.trainingFeedbackForm.findUnique({
      where: { organizationId: dbUser.organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        documentCode: true,
        isActive: true,
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
      },
    })

    return jsonResponse({ form }, 200, { 'Cache-Control': 'private, max-age=30' })
  } catch (err) {
    logger.error('AdminFeedbackForm GET', 'Form çekilemedi', { err, userId: dbUser.id })
    return errorResponse('Form yüklenemedi', 500)
  }
}

/**
 * PUT /api/admin/feedback/form
 * Tüm formu replace eder (client tüm kategori + item listesini gönderir).
 * Transaction: varolan categories/items silinir, yenileri oluşturulur.
 *
 * NOT: onDelete: Restrict → eski response'lar korunur. answer'lar eski item'a
 * bağlı kalır (Cascade silme sadece yeni cascade'den geçer). Response'lar
 * etkilenmediği için geçmiş raporlar intakt.
 */
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)
  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek')

  const parsed = trainingFeedbackFormUpsertSchema.safeParse(body)
  if (!parsed.success) {
    logger.error('AdminFeedbackForm PUT', 'Validasyon hatası', { issues: parsed.error.issues })
    return errorResponse('Form verisi geçersiz')
  }

  const data = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Form upsert — sadece meta alanları
      const form = await tx.trainingFeedbackForm.upsert({
        where: { organizationId: dbUser.organizationId! },
        create: {
          organizationId: dbUser.organizationId!,
          title: data.title,
          description: data.description ?? null,
          documentCode: data.documentCode ?? null,
          isActive: data.isActive,
        },
        update: {
          title: data.title,
          description: data.description ?? null,
          documentCode: data.documentCode ?? null,
          isActive: data.isActive,
        },
        select: { id: true },
      })

      // ── SMART MERGE (v1.1) ──
      // Amaç: Admin formu düzenlerken client `id` alanı gönderen kategoriler ve
      // item'ları KORU (update) — sadece id olmayanları create, gelmeyenleri
      // delete et. Böylece varolan response.answers FK cascade ile silinmez;
      // rapor geçmişi bozulmaz.

      // 1. Mevcut kategori + item ID'lerini çek
      const existing = await tx.trainingFeedbackCategory.findMany({
        where: { formId: form.id },
        select: { id: true, items: { select: { id: true } } },
      })
      const existingCatIds = new Set(existing.map(c => c.id))
      const existingItemIds = new Set(existing.flatMap(c => c.items.map(i => i.id)))

      // 2. Client tarafından tutulmak istenen ID'ler
      const keepCatIds = new Set<string>()
      const keepItemIds = new Set<string>()
      for (const cat of data.categories) {
        if (cat.id && existingCatIds.has(cat.id)) keepCatIds.add(cat.id)
        for (const item of cat.items) {
          if (item.id && existingItemIds.has(item.id)) keepItemIds.add(item.id)
        }
      }

      // 3. Silinecek kategoriler: mevcut ama client listesinde yok
      const catIdsToDelete = [...existingCatIds].filter(id => !keepCatIds.has(id))
      if (catIdsToDelete.length > 0) {
        // deleteMany — item'lar cascade silinir, answer'lar onlarla birlikte
        // (istemli silme — admin o soruyu kaldırdı)
        await tx.trainingFeedbackCategory.deleteMany({
          where: { id: { in: catIdsToDelete } },
        })
      }

      // 4. Silinecek item'lar: kategorisi korunuyor ama item'ın kendisi listede yok
      const itemIdsToDelete = [...existingItemIds].filter(id => !keepItemIds.has(id))
      if (itemIdsToDelete.length > 0) {
        await tx.trainingFeedbackItem.deleteMany({
          where: { id: { in: itemIdsToDelete } },
        })
      }

      // 5. Upsert kategoriler + item'lar
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
              data: { formId: form.id, name: cat.name, order: cat.order ?? ci },
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
                categoryId: savedCat.id, // kategori değiştiyse taşı
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

      return form.id
    })

    await createAuditLog({
      userId: dbUser.id,
      organizationId: dbUser.organizationId,
      action: 'feedback_form.updated',
      entityType: 'training_feedback_form',
      entityId: result,
      newData: { title: data.title, categoryCount: data.categories.length },
    })

    return jsonResponse({ success: true, formId: result })
  } catch (err) {
    logger.error('AdminFeedbackForm PUT', 'Güncelleme hatası', { err, userId: dbUser.id })
    return errorResponse('Form güncellenirken hata oluştu', 500)
  }
}
