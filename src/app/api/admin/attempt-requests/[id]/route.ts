import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
} from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
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
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) {
    return errorResponse('Kurum bilgisi bulunamadı', 403)
  }

  const allowed = await checkRateLimit(`attempt-req-review:${dbUser!.id}`, 30, 60)
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
      if (req.organizationId !== dbUser!.organizationId) throw new Error('FORBIDDEN')
      if (req.status !== 'pending') throw new Error('ALREADY_REVIEWED')

      if (parsed.data.action === 'approve') {
        const assignment = await tx.trainingAssignment.findFirst({
          where: { trainingId: req.trainingId, userId: req.userId },
          select: { id: true, maxAttempts: true, status: true },
        })
        if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND')
        if (assignment.status === 'passed') throw new Error('ALREADY_PASSED')

        const newMaxAttempts = assignment.maxAttempts + parsed.data.grantedAttempts

        await tx.trainingAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'assigned',
            maxAttempts: newMaxAttempts,
            completedAt: null,
          },
        })

        await tx.examAttemptRequest.update({
          where: { id },
          data: {
            status: 'approved',
            reviewedById: dbUser!.id,
            reviewedAt: new Date(),
            grantedAttempts: parsed.data.grantedAttempts,
            reviewNote: parsed.data.note ?? null,
          },
        })

        await tx.notification.create({
          data: {
            userId: req.userId,
            organizationId: dbUser!.organizationId!,
            title: 'Ek deneme talebiniz onaylandı',
            message: `"${req.training.title}" eğitimi için ${parsed.data.grantedAttempts} ek deneme hakkı verildi.`,
            type: 'assignment',
            relatedTrainingId: req.trainingId,
          },
        })

        return { action: 'approved' as const, grantedAttempts: parsed.data.grantedAttempts, newMaxAttempts }
      }

      // reject
      await tx.examAttemptRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: dbUser!.id,
          reviewedAt: new Date(),
          reviewNote: parsed.data.note,
        },
      })

      await tx.notification.create({
        data: {
          userId: req.userId,
          organizationId: dbUser!.organizationId!,
          title: 'Ek deneme talebiniz reddedildi',
          message: `"${req.training.title}" eğitimi için talebiniz reddedildi. Gerekçe: ${parsed.data.note}`,
          type: 'assignment',
          relatedTrainingId: req.trainingId,
        },
      })

      return { action: 'rejected' as const }
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: result.action === 'approved' ? 'attempt_request_approve' : 'attempt_request_reject',
      entityType: 'exam_attempt_request',
      entityId: id,
      newData: result,
      request,
    })

    return jsonResponse({ success: true, ...result })
  } catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case 'NOT_FOUND': return errorResponse('Talep bulunamadı', 404)
        case 'FORBIDDEN': return errorResponse('Yetkisiz erişim', 403)
        case 'ALREADY_REVIEWED': return errorResponse('Bu talep zaten değerlendirilmiş', 400)
        case 'ASSIGNMENT_NOT_FOUND': return errorResponse('Atama bulunamadı', 404)
        case 'ALREADY_PASSED': return errorResponse('Personel bu eğitimi zaten geçmiş', 400)
      }
    }
    logger.error('AdminAttemptRequests', 'Talep güncellenemedi', err)
    return errorResponse('İşlem sırasında hata oluştu', 500)
  }
}
