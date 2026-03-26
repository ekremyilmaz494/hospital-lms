import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { updateUserSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const staff = await prisma.user.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: {
      assignments: {
        include: { training: true, examAttempts: true },
        orderBy: { assignedAt: 'desc' },
      },
      _count: { select: { assignments: true, examAttempts: true } },
    },
  })

  if (!staff) return errorResponse('Staff not found', 404)

  // Resolve department name from ID if department field contains a UUID
  let departmentName = staff.department ?? ''
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const deptLookupId = staff.departmentId || (uuidRegex.test(departmentName) ? departmentName : null)
  if (deptLookupId) {
    const dept = await prisma.department.findUnique({ where: { id: deptLookupId } })
    if (dept) departmentName = dept.name
  }

  // Transform raw Prisma data to frontend format
  const completedAssignments = staff.assignments.filter(a => a.status === 'passed')
  const allAttempts = staff.assignments.flatMap(a => a.examAttempts)
  const scoredAttempts = allAttempts.filter(a => a.postExamScore !== null)
  const avgScore = scoredAttempts.length > 0
    ? (scoredAttempts.reduce((sum, a) => sum + Number(a.postExamScore ?? 0), 0) / scoredAttempts.length).toFixed(0)
    : '0'
  const successRate = staff.assignments.length > 0
    ? ((completedAssignments.length / staff.assignments.length) * 100).toFixed(0)
    : '0'

  const result = {
    id: staff.id,
    name: `${staff.firstName} ${staff.lastName}`,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    tcNo: staff.tcNo ?? '',
    department: departmentName,
    departmentId: staff.departmentId,
    title: staff.title ?? '',
    phone: staff.phone ?? '',
    initials: `${(staff.firstName?.[0] ?? '').toUpperCase()}${(staff.lastName?.[0] ?? '').toUpperCase()}`,
    isActive: staff.isActive,
    stats: {
      assignedTrainings: staff.assignments.length,
      completedTrainings: completedAssignments.length,
      successRate: `%${successRate}`,
      avgScore: avgScore,
    },
    trainingHistory: staff.assignments.map(a => {
      const lastAttempt = a.examAttempts.sort((x, y) =>
        new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
      )[0]
      return {
        title: a.training.title,
        attempt: a.examAttempts.length,
        preScore: lastAttempt?.preExamScore ? Number(lastAttempt.preExamScore) : null,
        postScore: lastAttempt?.postExamScore ? Number(lastAttempt.postExamScore) : null,
        status: a.status,
        date: a.assignedAt?.toISOString?.() ?? new Date().toISOString(),
      }
    }),
  }

  return jsonResponse(result)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  // role ve organizationId değiştirilmesini engelle — privilege escalation önlemi
  const safeSchema = updateUserSchema.omit({ role: true, organizationId: true })
  const parsed = safeSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Staff not found', 404)

  const dataToUpdate = { ...parsed.data }
  if (dataToUpdate.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: dataToUpdate.departmentId } })
    if (dept) {
      dataToUpdate.department = dept.name
    }
  }

  const staff = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'update',
    entityType: 'user',
    entityId: id,
    oldData: existing,
    newData: staff,
    request,
  })

  revalidatePath('/admin/staff')

  return jsonResponse(staff)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Staff not found', 404)

  // Soft delete — deactivate
  await prisma.user.update({ where: { id }, data: { isActive: false } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'deactivate',
    entityType: 'user',
    entityId: id,
    request,
  })

  revalidatePath('/admin/staff')

  return jsonResponse({ success: true })
}
