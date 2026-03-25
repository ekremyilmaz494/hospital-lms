import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createAssignmentSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const assignments = await prisma.trainingAssignment.findMany({
    where: { trainingId: id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
      examAttempts: { orderBy: { attemptNumber: 'desc' } },
    },
    orderBy: { assignedAt: 'desc' },
  })

  return jsonResponse(assignments)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createAssignmentSchema.safeParse({ ...body as object, trainingId: id })
  if (!parsed.success) return errorResponse(parsed.error.message)

  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId } })
  if (!training) return errorResponse('Training not found', 404)

  // Create assignments for all users (skip existing)
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: { trainingId: id, userId: { in: parsed.data.userIds } },
    select: { userId: true },
  })
  const existingUserIds = new Set(existingAssignments.map(a => a.userId))
  const newUserIds = parsed.data.userIds.filter(uid => !existingUserIds.has(uid))

  if (newUserIds.length === 0) return errorResponse('Tüm kullanıcılar zaten atanmış')

  const assignments = await prisma.trainingAssignment.createMany({
    data: newUserIds.map(userId => ({
      trainingId: id,
      userId,
      maxAttempts: parsed.data.maxAttempts,
      assignedById: dbUser!.id,
    })),
  })

  // Create notifications for assigned users
  await prisma.notification.createMany({
    data: newUserIds.map(userId => ({
      userId,
      organizationId: dbUser!.organizationId,
      title: 'Yeni Eğitim Atandı',
      message: `"${training.title}" eğitimi size atandı.`,
      type: 'assignment',
      relatedTrainingId: id,
    })),
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'assign',
    entityType: 'training_assignment',
    entityId: id,
    newData: { userIds: newUserIds, count: assignments.count },
    request,
  })

  return jsonResponse({ created: assignments.count, skipped: existingUserIds.size }, 201)
}
