import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'
import { KVKK_REQUEST_TYPE_LABELS, type KvkkRequestType } from '@/lib/kvkk/request-types'

const respondSchema = z
  .object({
    status: z.enum(['in_progress', 'completed', 'rejected']),
    responseNote: z.string().trim().max(2000).optional(),
  })
  // Tamamlama/red kişiye tebliğ edilir → gerekçe zorunlu. İşleme-alma notsuz olabilir.
  .refine((d) => d.status === 'in_progress' || (d.responseNote != null && d.responseNote.length >= 3), {
    message: 'Tamamlama/red için yanıt notu en az 3 karakter olmalıdır',
    path: ['responseNote'],
  })

const NOTIFY: Record<'in_progress' | 'completed' | 'rejected', { title: string; verb: string }> = {
  in_progress: { title: 'KVKK talebiniz işleme alındı', verb: 'işleme alındı' },
  completed: { title: 'KVKK talebiniz tamamlandı', verb: 'tamamlandı' },
  rejected: { title: 'KVKK talebiniz reddedildi', verb: 'reddedildi' },
}

/** PATCH /api/admin/kvkk-requests/[id] — KVKK hak talebini yanıtla/işleme al/reddet.
 *  Personelin açtığı talebi admin buradan sonuçlandırır; personele bildirim + audit yazılır. */
export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params

  const allowed = await checkRateLimit(`kvkk-req-review:${dbUser.id}`, 30, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody<unknown>(request)
  if (!body) return errorResponse('Geçersiz istek', 400)

  const parsed = respondSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { status, responseNote } = parsed.data
  const isTerminal = status === 'completed' || status === 'rejected'

  try {
    await prisma.$transaction(async (tx) => {
      const req = await tx.kvkkRequest.findUnique({
        where: { id },
        select: { id: true, status: true, organizationId: true, userId: true, requestType: true },
      })

      if (!req) throw new Error('NOT_FOUND')
      if (req.organizationId !== organizationId) throw new Error('FORBIDDEN')
      // Yalnız açık talepler sonuçlandırılabilir (pending/in_progress) — terminal talep tekrar yazılmaz.
      if (req.status !== 'pending' && req.status !== 'in_progress') throw new Error('ALREADY_RESOLVED')

      await tx.kvkkRequest.update({
        where: { id },
        data: {
          status,
          // İşleme-alma notu boş gelirse mevcut notu koru (undefined → değişiklik yok)
          responseNote: responseNote ?? undefined,
          respondedById: dbUser.id,
          completedAt: isTerminal ? new Date() : null,
        },
      })

      const typeLabel = KVKK_REQUEST_TYPE_LABELS[req.requestType as KvkkRequestType]?.label ?? 'KVKK'
      const notify = NOTIFY[status]
      await tx.notification.create({
        data: {
          userId: req.userId,
          organizationId,
          title: notify.title,
          message: responseNote
            ? `"${typeLabel}" talebiniz ${notify.verb}. Yanıt: ${responseNote}`
            : `"${typeLabel}" talebiniz ${notify.verb}.`,
          type: 'info',
          senderId: dbUser.id,
        },
      })
    })

    await audit({
      action: 'KVKK_REQUEST_RESPONDED',
      entityType: 'kvkk_request',
      entityId: id,
      newData: { status },
    })

    return jsonResponse({ success: true, status })
  } catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case 'NOT_FOUND':
          return errorResponse('Talep bulunamadı', 404)
        case 'FORBIDDEN':
          return errorResponse('Yetkisiz erişim', 403)
        case 'ALREADY_RESOLVED':
          return errorResponse('Bu talep zaten sonuçlandırılmış', 400)
      }
    }
    logger.error('AdminKvkkRequests', 'Talep güncellenemedi', err)
    return errorResponse('İşlem sırasında hata oluştu', 500)
  }
}, { requireOrganization: true })
