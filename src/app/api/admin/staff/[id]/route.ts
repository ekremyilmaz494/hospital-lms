import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { z } from 'zod/v4'

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
      departmentRel: { select: { name: true } },
      _count: { select: { assignments: true, examAttempts: true } },
    },
  })

  if (!staff) return errorResponse('Personel bulunamadı', 404)

  const departmentName = staff.departmentRel?.name ?? ''

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
    tcNo: staff.tcNo ? `*******${staff.tcNo.slice(-4)}` : '',
    department: departmentName,
    departmentId: staff.departmentId,
    title: staff.title ?? '',
    phone: staff.phone ?? '',
    initials: `${(staff.firstName?.[0] ?? '').toUpperCase()}${(staff.lastName?.[0] ?? '').toUpperCase()}`,
    isActive: staff.isActive,
    stats: {
      assignedTrainings: staff.assignments.length,
      completedTrainings: completedAssignments.length,
      successRate: `${successRate}%`,
      avgScore: avgScore,
    },
    trainingHistory: staff.assignments.map(a => {
      const lastAttempt = a.examAttempts.sort((x, y) =>
        new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
      )[0]
      return {
        trainingId: a.trainingId,
        title: a.training.title,
        attempt: a.examAttempts.length,
        maxAttempts: a.maxAttempts,
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
  if (!body) return errorResponse('Geçersiz istek verisi')

  // Explicit whitelist — only allow safe fields to be updated
  const safeUpdateSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(20).optional(),
    tcNo: z.string().length(11).optional(),
    title: z.string().max(100).optional(),
    departmentId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  const parsed = safeUpdateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Personel bulunamadı', 404)

  const dataToUpdate = { ...parsed.data }

  const staff = await prisma.user.update({
    where: { id, organizationId: dbUser!.organizationId! },
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

  const allowed = await checkRateLimit(`staff-delete:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Personel bulunamadı', 404)

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
