import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateTrainingSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const training = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: {
      videos: { orderBy: { sortOrder: 'asc' } },
      questions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
          examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
        },
      },
      _count: { select: { assignments: true, questions: true, videos: true } },
    },
  })

  if (!training) return errorResponse('Training not found', 404)

  return jsonResponse(training)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = updateTrainingSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Training not found', 404)

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)

  const training = await prisma.training.update({ where: { id }, data })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'update',
    entityType: 'training',
    entityId: id,
    oldData: existing,
    newData: training,
    request,
  })

  return jsonResponse(training)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const existing = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Training not found', 404)

  // Soft delete: isActive false yap, cascade silme yerine veri korunur
  await prisma.training.update({ where: { id }, data: { isActive: false } })

  // Aktif atamalari iptal et (assigned/in_progress → locked)
  await prisma.trainingAssignment.updateMany({
    where: { trainingId: id, status: { in: ['assigned', 'in_progress'] } },
    data: { status: 'locked' },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'deactivate',
    entityType: 'training',
    entityId: id,
    oldData: existing,
    request,
  })

  return jsonResponse({ success: true })
}
