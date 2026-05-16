import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { updateSmgTargetSchema } from '@/lib/validations'

export const PUT = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateSmgTargetSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.smgTarget.findFirst({
    where: { id, organizationId },
  })
  if (!existing) return errorResponse('Hedef bulunamadı', 404)

  const updated = await prisma.smgTarget.update({
    where: { id },
    data: { requiredPoints: parsed.data.requiredPoints },
  })

  await audit({
    action: 'UPDATE',
    entityType: 'SmgTarget',
    entityId: id,
    oldData: existing,
    newData: updated,
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params

  const existing = await prisma.smgTarget.findFirst({
    where: { id, organizationId },
  })
  if (!existing) return errorResponse('Hedef bulunamadı', 404)

  await prisma.smgTarget.delete({ where: { id } })

  await audit({
    action: 'DELETE',
    entityType: 'SmgTarget',
    entityId: id,
    oldData: existing,
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
