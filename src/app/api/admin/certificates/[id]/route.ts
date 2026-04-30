import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PATCH — Sertifika iptal et */
export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params
  if (!UUID_REGEX.test(id)) return errorResponse('Geçersiz sertifika ID', 400)

  const allowed = await checkRateLimit(`cert-revoke:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const { action, reason } = body as { action?: string; reason?: string }

  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: { training: { select: { organizationId: true, title: true } }, user: { select: { firstName: true, lastName: true } } },
  })

  if (!cert || cert.training.organizationId !== organizationId) {
    return errorResponse('Sertifika bulunamadı', 404)
  }

  if (action === 'revoke') {
    if (!reason || reason.trim().length < 5) {
      return errorResponse('İptal nedeni en az 5 karakter olmalıdır', 400)
    }
    if (cert.revokedAt) {
      return errorResponse('Bu sertifika zaten iptal edilmiş', 400)
    }

    const updated = await prisma.certificate.update({
      where: { id },
      data: { revokedAt: new Date(), revocationReason: reason.trim() },
    })

    await audit({
      action: 'certificate.revoked',
      entityType: 'certificate',
      entityId: id,
      oldData: { certificateCode: cert.certificateCode },
      newData: { revokedAt: updated.revokedAt, revocationReason: reason.trim() },
    })

    return jsonResponse({ success: true, message: 'Sertifika iptal edildi' })
  }

  if (action === 'restore') {
    if (!cert.revokedAt) {
      return errorResponse('Bu sertifika iptal edilmemiş', 400)
    }

    await prisma.certificate.update({
      where: { id },
      data: { revokedAt: null, revocationReason: null },
    })

    await audit({
      action: 'certificate.restored',
      entityType: 'certificate',
      entityId: id,
      newData: { certificateCode: cert.certificateCode },
    })

    return jsonResponse({ success: true, message: 'Sertifika yeniden aktif edildi' })
  }

  return errorResponse('Geçersiz işlem. "revoke" veya "restore" kullanın.', 400)
}, { requireOrganization: true })
