import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, getAuthUserWithWriteGuard, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { z } from 'zod/v4'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Lightweight mode for edit form — only basic fields, no training history
  const { searchParams } = new URL(request.url)
  if (searchParams.get('fields') === 'edit') {
    const staff = await prisma.user.findFirst({ // perf-check-disable-line
      where: { id, organizationId: dbUser!.organizationId! },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, departmentId: true, title: true, isActive: true,
      },
    })
    if (!staff) return errorResponse('Personel bulunamadı', 404)

    let departmentName = ''
    if (staff.departmentId) {
      const dept = await prisma.department.findFirst({ // perf-check-disable-line
        where: { id: staff.departmentId, organizationId: dbUser!.organizationId! },
        select: { name: true },
      })
      if (dept) departmentName = dept.name
    }

    return jsonResponse({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone ?? '',
      department: departmentName,
      departmentId: staff.departmentId,
      title: staff.title ?? '',
      initials: `${(staff.firstName?.[0] ?? '').toUpperCase()}${(staff.lastName?.[0] ?? '').toUpperCase()}`,
      isActive: staff.isActive,
    }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  }

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

  if (!staff) return errorResponse('Personel bulunamadı', 404)

  // Resolve department name — always scope to organizationId (B4.2: cross-tenant guard)
  let departmentName = ''
  if (staff.departmentId) {
    const dept = await prisma.department.findFirst({ // perf-check-disable-line
      where: { id: staff.departmentId, organizationId: dbUser!.organizationId! },
    })
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

  return jsonResponse(result, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUserWithWriteGuard(request)
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
    title: z.string().max(100).optional(),
    departmentId: z.string().uuid().optional(),
    department: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  })
  const parsed = safeUpdateSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  // B4.2/G4.2 — Paralel: kullanıcı varlığı + departman doğrulaması aynı anda
  const [existing, deptCheck] = await Promise.all([
    prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } }),
    parsed.data.departmentId
      ? prisma.department.findFirst({ where: { id: parsed.data.departmentId, organizationId: dbUser!.organizationId! } })
      : Promise.resolve(null),
  ])
  if (!existing) return errorResponse('Personel bulunamadı', 404)

  const dataToUpdate: Record<string, unknown> = { ...parsed.data }
  if (dataToUpdate.departmentId) {
    if (!deptCheck) return errorResponse('Geçersiz departman — bu departman organizasyonunuza ait değil', 400)
    dataToUpdate.department = deptCheck.name
  }

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

  try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}
  try { await invalidateOrgCache(dbUser!.organizationId!, 'staff') } catch {}

  return jsonResponse(staff)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUserWithWriteGuard(request)
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`staff-delete:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const existing = await prisma.user.findFirst({ where: { id, organizationId: dbUser!.organizationId! } }) // perf-check-disable-line
  if (!existing) return errorResponse('Personel bulunamadı', 404)

  // B4.4 — Soft delete: deactivate + aktif sınavları iptal et (multi-tenant güvenli)
  await prisma.$transaction([
    prisma.user.updateMany({ where: { id, organizationId: dbUser!.organizationId! }, data: { isActive: false } }),
    prisma.examAttempt.updateMany({
      where: {
        userId: id,
        status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
      },
      data: { status: 'expired', isPassed: false, postExamCompletedAt: new Date() },
    }),
  ])

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'deactivate',
    entityType: 'user',
    entityId: id,
    request,
  })

  revalidatePath('/admin/staff')

  try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}
  try { await invalidateOrgCache(dbUser!.organizationId!, 'staff') } catch {}

  return jsonResponse({ success: true })
}
