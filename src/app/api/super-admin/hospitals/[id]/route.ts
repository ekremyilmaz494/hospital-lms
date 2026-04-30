import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { updateOrganizationSchema } from '@/lib/validations'

export const GET = withSuperAdminRoute<{ id: string }>(async ({ params }) => {
  const { id } = params

  const hospital = await prisma.organization.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      users: { orderBy: { createdAt: 'desc' }, take: 10 },
      trainings: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { users: true, trainings: true, auditLogs: true } },
    },
  })

  if (!hospital) return errorResponse('Hospital not found', 404)

  return jsonResponse(hospital)
})

export const PATCH = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = updateOrganizationSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const oldData = await prisma.organization.findUnique({ where: { id } })
  if (!oldData) return errorResponse('Hospital not found', 404)

  const hospital = await prisma.organization.update({
    where: { id },
    data: parsed.data,
  })

  await audit({
    action: 'update',
    entityType: 'organization',
    entityId: id,
    oldData,
    newData: hospital,
  })

  return jsonResponse(hospital)
})

export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id } = params

  const oldData = await prisma.organization.findUnique({ where: { id } })
  if (!oldData) return errorResponse('Hospital not found', 404)

  // Count all cascading data — caller must explicitly confirm deletion
  const { searchParams } = new URL(request.url)
  const confirmed = searchParams.get('confirm') === 'true'

  const [userCount, trainingCount, assignmentCount] = await Promise.all([
    prisma.user.count({ where: { organizationId: id } }),
    prisma.training.count({ where: { organizationId: id } }),
    prisma.trainingAssignment.count({ where: { training: { organizationId: id } } }),
  ])

  const impact = { users: userCount, trainings: trainingCount, assignments: assignmentCount }
  const hasData = userCount > 0 || trainingCount > 0 || assignmentCount > 0

  // Return impact summary without deleting — UI uses this to show confirmation dialog
  if (hasData && !confirmed) {
    return jsonResponse({ requiresConfirmation: true, impact }, 409)
  }

  await prisma.organization.delete({ where: { id } })

  await audit({
    action: 'delete',
    entityType: 'organization',
    entityId: id,
    oldData,
    newData: { impact },
  })

  return jsonResponse({ success: true, impact })
})
