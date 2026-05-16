import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const form = await prisma.competencyForm.findFirst({
    where: { id, organizationId },
    include: {
      categories: {
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { evaluations: true } },
    },
  })

  if (!form) return errorResponse('Form bulunamadı', 404)
  return jsonResponse(form, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

export const PUT = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const form = await prisma.competencyForm.findFirst({ // perf-check-disable-line
    where: { id, organizationId },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const updated = await prisma.$transaction(async (tx) => {
    const verified = await tx.competencyForm.findFirst({ where: { id, organizationId } })
    if (!verified) throw new Error('NOT_FOUND')
    return tx.competencyForm.update({
      where: { id },
      data: {
        ...(typeof body.title === 'string' && { title: body.title }),
        ...(typeof body.description === 'string' && { description: body.description }),
        ...(typeof body.targetRole === 'string' && { targetRole: body.targetRole }),
        ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
      },
    })
  })

  await audit({
    action: 'UPDATE',
    entityType: 'CompetencyForm',
    entityId: id,
    oldData: { isActive: form.isActive },
    newData: { isActive: updated.isActive },
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params

  const form = await prisma.competencyForm.findFirst({
    where: { id, organizationId },
  })
  if (!form) return errorResponse('Form bulunamadı', 404)

  const deleted = await prisma.competencyForm.deleteMany({ where: { id, organizationId } })
  if (deleted.count === 0) return errorResponse('Form bulunamadi veya yetkiniz yok', 404)

  await audit({
    action: 'DELETE',
    entityType: 'CompetencyForm',
    entityId: id,
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
