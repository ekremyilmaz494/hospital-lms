import { prisma } from '@/lib/prisma'
import { jsonResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

export const POST = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id } = params

  const body = await parseBody<{ reason?: string }>(request)

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: true,
      suspendedReason: body?.reason ?? null,
      suspendedAt: new Date(),
    },
  })

  await audit({
    action: 'suspend',
    entityType: 'organization',
    entityId: id,
    newData: { reason: body?.reason },
  })

  return jsonResponse(organization)
})

export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, audit }) => {
  const { id } = params

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: false,
      suspendedReason: null,
      suspendedAt: null,
    },
  })

  await audit({
    action: 'unsuspend',
    entityType: 'organization',
    entityId: id,
  })

  return jsonResponse(organization)
})
