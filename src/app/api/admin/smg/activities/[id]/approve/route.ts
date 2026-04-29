import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { approveSmgActivitySchema } from '@/lib/validations'

export const PUT = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = approveSmgActivitySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId },
  })

  if (!activity) return errorResponse('Aktivite bulunamadı', 404)

  // Mevcut durum zaten istenen durum ise işlem anlamsız — kullanıcıya 409 dön.
  if (activity.approvalStatus === parsed.data.status) {
    return errorResponse(
      `Aktivite zaten "${parsed.data.status === 'APPROVED' ? 'onaylanmış' : 'reddedilmiş'}" durumdadır.`,
      409
    )
  }

  const updated = await prisma.smgActivity.update({
    where: { id },
    data: {
      approvalStatus: parsed.data.status,
      approvedBy: dbUser.id,
      approvedAt: new Date(),
      ...(parsed.data.status === 'REJECTED' && parsed.data.rejectionReason
        ? { rejectionReason: parsed.data.rejectionReason }
        : {}),
    },
  })

  await audit({
    action: parsed.data.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    entityType: 'SmgActivity',
    entityId: id,
    oldData: { approvalStatus: activity.approvalStatus },
    newData: { approvalStatus: parsed.data.status },
  })

  return jsonResponse(updated)
}, { requireOrganization: true })
