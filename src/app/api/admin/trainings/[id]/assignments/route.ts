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

  if (!dbUser!.organizationId) return errorResponse('Organization not found', 403)
  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!training) return errorResponse('Training not found', 404)

  // Create assignments for all users (skip existing)
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: { trainingId: id, userId: { in: parsed.data.userIds } },
    select: { userId: true },
  })
  const existingUserIds = new Set(existingAssignments.map(a => a.userId))
  const newUserIds = parsed.data.userIds.filter(uid => !existingUserIds.has(uid))

  if (newUserIds.length === 0) return errorResponse('Tüm kullanıcılar zaten atanmış')

  // Org kontrolü: atanacak kullanıcılar admin'in organizasyonuna ait mi?
  const orgUsers = await prisma.user.count({
    where: { id: { in: newUserIds }, organizationId: dbUser!.organizationId! },
  })
  if (orgUsers !== newUserIds.length) return errorResponse('Bazı kullanıcılar kurumunuza ait değil', 403)

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
      organizationId: dbUser!.organizationId!,
      title: 'Yeni Eğitim Atandı',
      message: `"${training.title}" eğitimi size atandı.`,
      type: 'assignment',
      relatedTrainingId: id,
    })),
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'assign',
    entityType: 'training_assignment',
    entityId: id,
    newData: { userIds: newUserIds, count: assignments.count },
    request,
  })

  return jsonResponse({ created: assignments.count, skipped: existingUserIds.size }, 201)
}

/** PATCH — Yönetici: başarısız eğitimi yeniden aç + ek deneme hakkı ver */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: trainingId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<{ userId: string; additionalAttempts?: number }>(request)
  if (!body?.userId) return errorResponse('userId zorunludur')

  const assignment = await prisma.trainingAssignment.findFirst({
    where: { trainingId, userId: body.userId },
    include: { training: { select: { title: true, organizationId: true } } },
  })

  if (!assignment) return errorResponse('Atama bulunamadı', 404)
  if (assignment.training.organizationId !== dbUser!.organizationId) return errorResponse('Yetkisiz erişim', 403)
  if (assignment.status === 'passed') return errorResponse('Bu personel zaten başarılı olmuş')

  const additionalAttempts = Math.min(Math.max(body.additionalAttempts ?? 1, 1), 10)
  const newMaxAttempts = assignment.maxAttempts + additionalAttempts

  await prisma.trainingAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'assigned',
      maxAttempts: newMaxAttempts,
    },
  })

  await prisma.notification.create({
    data: {
      userId: body.userId,
      organizationId: dbUser!.organizationId!,
      title: 'Eğitim Yeniden Açıldı',
      message: `"${assignment.training.title}" eğitimi için ${additionalAttempts} ek deneme hakkı verildi.`,
      type: 'assignment',
      relatedTrainingId: trainingId,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'reopen_assignment',
    entityType: 'training_assignment',
    entityId: assignment.id,
    newData: { userId: body.userId, additionalAttempts, newMaxAttempts },
    request,
  })

  return jsonResponse({ success: true, newMaxAttempts })
}
