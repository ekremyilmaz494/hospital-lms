import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/feedback/forms/[id]/activate
 *
 * "Tüm Eğitimlere Ata" aksiyonu — tek transaction:
 *  1) Org'daki diğer formları taslağa düşür (partial unique index ile uyumlu)
 *  2) Hedef formu aktive et — `isMandatory` değerini transaction İÇİNDE oku
 *     (race-safe: başka admin PUT'la değiştirirse stale değer kullanılmaz)
 *  3) Org'daki TÜM Training.feedbackMandatory = form.isMandatory yap
 *
 * 3. adım istenen davranışı verir: form "zorunlu" işaretliyse aktive olduğu
 * anda her eğitim feedback bekler (sertifika gating tetiklenir); "opsiyonel"
 * işaretliyse hiçbir eğitimde zorunlu değildir.
 *
 * Yarış kondisyonu: partial unique index (uniq_active_feedback_form_per_org)
 * iki adminin aynı anda farklı form aktive etmesini DB seviyesinde engeller.
 */
export const POST = withAdminRoute<{ id: string }>(
  async ({ params, dbUser, organizationId, audit }) => {
    const { id } = params

    // Aktivasyon storm'u (admin butona ısrarla basıyor) önlemek için 1 dk'da 10 istek.
    const allowed = await checkRateLimit(`feedback-activate:${dbUser.id}`, 10, 60)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Çok fazla aktivasyon. Lütfen biraz bekleyin.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } },
      )
    }

    let trainingsUpdated = 0
    let isMandatory = true
    let title = ''
    try {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Form ve isMandatory'yi transaction İÇİNDE oku — race-safe.
          // Başka admin PUT'la isMandatory'i değiştirirse o işlem ya bizden önce
          // ya sonra commit eder; ortada stale değer okuma yok.
          const target = await tx.trainingFeedbackForm.findFirst({
            where: { id, organizationId },
            select: {
              id: true, title: true, isActive: true, isMandatory: true, isArchived: true,
              categories: { select: { _count: { select: { items: true } } } },
            },
          })
          if (!target) throw new ApiError404('Form bulunamadı')
          if (target.isArchived) throw new ApiError400('Arşivli form aktive edilemez. Önce arşivden çıkar.')

          const totalItems = target.categories.reduce((sum, c) => sum + c._count.items, 0)
          if (target.categories.length === 0 || totalItems === 0) {
            throw new ApiError400('Form aktive edilemez: en az 1 kategori ve 1 soru gerekli.')
          }

          if (!target.isActive) {
            await tx.trainingFeedbackForm.updateMany({
              where: { organizationId, isActive: true, NOT: { id } },
              data: { isActive: false },
            })
            await tx.trainingFeedbackForm.update({
              where: { id },
              data: { isActive: true },
            })
          }

          const updated = await tx.training.updateMany({
            where: {
              organizationId,
              publishStatus: 'published',
              feedbackMandatory: { not: target.isMandatory },
            },
            data: { feedbackMandatory: target.isMandatory },
          })
          return { count: updated.count, isMandatory: target.isMandatory, title: target.title }
        })
        trainingsUpdated = result.count
        isMandatory = result.isMandatory
        title = result.title
      } catch (err) {
        if (err instanceof ApiError404) return errorResponse(err.message, 404)
        if (err instanceof ApiError400) return errorResponse(err.message, 400)
        if ((err as { code?: string })?.code === 'P2002') {
          return errorResponse(
            'Form başka bir admin tarafından değiştirilmiş. Lütfen sayfayı yenile.',
            409,
          )
        }
        throw err
      }

      await audit({
        action: 'feedback_form.activated',
        entityType: 'training_feedback_form',
        entityId: id,
        newData: { title, isMandatory, trainingsUpdated },
      })

      return jsonResponse({ success: true, isMandatory, trainingsUpdated })
    } catch (err) {
      logger.error('AdminFeedbackForm ACTIVATE', 'Aktive edilemedi', { err, userId: dbUser.id, id })
      return errorResponse('Form aktive edilemedi', 500)
    }
  },
  { requireOrganization: true },
)

// Transaction-içi tipli throw için minik sentinel sınıfları — handler bunları
// status code'a çevirir, generic 500'a düşmez.
class ApiError400 extends Error {}
class ApiError404 extends Error {}
