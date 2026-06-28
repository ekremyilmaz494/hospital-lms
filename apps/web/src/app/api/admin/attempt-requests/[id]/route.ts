import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { grantAttempts, AttemptGrantError } from '@/lib/attempt-grants'
import { z } from 'zod/v4'

const reviewSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    grantedAttempts: z.number().int().min(1).max(10).default(1),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    note: z.string().trim().min(3, 'Red gerekçesi en az 3 karakter olmalı').max(500),
  }),
])

/** PATCH /api/admin/attempt-requests/[id] — Talebi onayla veya reddet */
export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`attempt-req-review:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Geçersiz istek', 400)

  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '), 400)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const req = await tx.examAttemptRequest.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          organizationId: true,
          userId: true,
          trainingId: true,
          training: { select: { title: true } },
        },
      })

      if (!req) throw new Error('NOT_FOUND')
      if (req.organizationId !== organizationId) throw new Error('FORBIDDEN')
      if (req.status !== 'pending') throw new Error('ALREADY_REVIEWED')

      if (parsed.data.action === 'approve') {
        // Discriminated union'ı closure'a taşımadan önce narrow'lanan değeri yakala.
        const grantedAttempts = parsed.data.grantedAttempts
        const reviewNote = parsed.data.note ?? null

        // Ortak helper: en yeni round'u deterministik çöz (N1 koruması), state-machine ile
        // doğrula (passed/locked reddi), maxAttempts'i artır, personele bildir. Bu talebin
        // kendisini aşağıda 'approved' işaretliyoruz → reconcile gerekmez.
        const grant = await grantAttempts(tx, {
          organizationId,
          reviewerId: dbUser.id,
          target: { trainingId: req.trainingId, userId: req.userId },
          computeNewMax: (a) => a.maxAttempts + grantedAttempts,
          notify: {
            title: 'Ek deneme talebiniz onaylandı',
            message: (title) => `"${title}" eğitimi için ${grantedAttempts} ek deneme hakkı verildi.`,
          },
          reconcilePendingRequest: false,
        })

        await tx.examAttemptRequest.update({
          where: { id },
          data: {
            status: 'approved',
            reviewedById: dbUser.id,
            reviewedAt: new Date(),
            grantedAttempts,
            reviewNote,
          },
        })

        return { action: 'approved' as const, grantedAttempts, newMaxAttempts: grant.newMaxAttempts }
      }

      // reject
      await tx.examAttemptRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: dbUser.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note,
        },
      })

      await tx.notification.create({
        data: {
          userId: req.userId,
          organizationId,
          title: 'Ek deneme talebiniz reddedildi',
          message: `"${req.training.title}" eğitimi için talebiniz reddedildi. Gerekçe: ${parsed.data.note}`,
          type: 'assignment',
          relatedTrainingId: req.trainingId,
        },
      })

      return { action: 'rejected' as const }
    })

    await audit({
      action: result.action === 'approved' ? 'attempt_request_approve' : 'attempt_request_reject',
      entityType: 'exam_attempt_request',
      entityId: id,
      newData: result,
    })

    return jsonResponse({ success: true, ...result })
  } catch (err) {
    if (err instanceof AttemptGrantError) {
      return errorResponse(err.message, err.code === 'ASSIGNMENT_NOT_FOUND' ? 404 : 400)
    }
    if (err instanceof Error) {
      switch (err.message) {
        case 'NOT_FOUND': return errorResponse('Talep bulunamadı', 404)
        case 'FORBIDDEN': return errorResponse('Yetkisiz erişim', 403)
        case 'ALREADY_REVIEWED': return errorResponse('Bu talep zaten değerlendirilmiş', 400)
      }
    }
    logger.error('AdminAttemptRequests', 'Talep güncellenemedi', err)
    return errorResponse('İşlem sırasında hata oluştu', 500)
  }
}, { requireOrganization: true })
