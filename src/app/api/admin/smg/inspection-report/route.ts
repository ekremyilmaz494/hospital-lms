import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { inspectionReportQuerySchema } from '@/lib/validations'
import { resolveRequiredPointsBulk } from '@/lib/smg-helpers'
import type { UserRole } from '@/types/database'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const parsed = inspectionReportQuerySchema.safeParse({
    periodId: searchParams.get('periodId') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    format: searchParams.get('format') ?? undefined,
  })
  if (!parsed.success) return errorResponse(parsed.error.message)

  const orgId = dbUser!.organizationId!
  const { periodId, startDate, endDate, departmentId } = parsed.data

  // Dönem veya custom range
  let period: { id: string; name: string; startDate: Date; endDate: Date; requiredPoints: number } | null = null
  let rangeStart: Date
  let rangeEnd: Date

  if (periodId) {
    period = await prisma.smgPeriod.findFirst({
      where: { id: periodId, organizationId: orgId },
      select: { id: true, name: true, startDate: true, endDate: true, requiredPoints: true },
    })
    if (!period) return errorResponse('Dönem bulunamadı', 404)
    rangeStart = period.startDate
    rangeEnd = period.endDate
  } else if (startDate && endDate) {
    rangeStart = new Date(startDate)
    rangeEnd = new Date(endDate)
  } else {
    period = await prisma.smgPeriod.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, startDate: true, endDate: true, requiredPoints: true },
    })
    if (!period) {
      return errorResponse('Aktif SMG dönemi bulunamadı. Lütfen periodId veya tarih aralığı belirtin.', 400)
    }
    rangeStart = period.startDate
    rangeEnd = period.endDate
  }

  const [organization, staff, activities, pendingCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: 'staff' satisfies UserRole,
        isActive: true,
        ...(departmentId && { departmentId }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        departmentRel: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.smgActivity.findMany({
      where: {
        organizationId: orgId,
        approvalStatus: 'APPROVED',
        completionDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        provider: true,
        completionDate: true,
        smgPoints: true,
        approvedAt: true,
        category: { select: { name: true, code: true } },
      },
      orderBy: { completionDate: 'desc' },
    }),
    prisma.smgActivity.count({
      where: {
        organizationId: orgId,
        approvalStatus: 'PENDING',
        completionDate: { gte: rangeStart, lte: rangeEnd },
      },
    }),
  ])

  // Hedef puanları toplu resolve (N+1 önle)
  const periodFallback = period?.requiredPoints ?? 0
  const requiredMap = period
    ? await resolveRequiredPointsBulk({
        prisma,
        periodId: period.id,
        organizationId: orgId,
        periodFallback,
        users: staff.map(s => ({ id: s.id, title: s.title })),
      })
    : new Map<string, number>()

  // Aktiviteleri kullanıcıya grupla
  const activitiesByUser = new Map<string, typeof activities>()
  for (const act of activities) {
    const list = activitiesByUser.get(act.userId) ?? []
    list.push(act)
    activitiesByUser.set(act.userId, list)
  }

  // Personel detay
  const staffDetail = staff.map(u => {
    const userActs = activitiesByUser.get(u.id) ?? []
    const earnedPoints = userActs.reduce((sum, a) => sum + a.smgPoints, 0)
    const required = requiredMap.get(u.id) ?? periodFallback
    const progress = required > 0 ? Math.min(100, Math.round((earnedPoints / required) * 100)) : 0
    return {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      unvan: u.title ?? null,
      department: u.departmentRel?.name ?? null,
      departmentId: u.departmentRel?.id ?? null,
      earnedPoints,
      requiredPoints: required,
      progress,
      isCompliant: earnedPoints >= required && required > 0,
      activities: userActs.map(a => ({
        title: a.title,
        categoryName: a.category?.name ?? 'Kategorisiz',
        provider: a.provider,
        completionDate: a.completionDate,
        smgPoints: a.smgPoints,
        approvedAt: a.approvedAt,
      })),
    }
  })

  // Özet
  const totalStaff = staffDetail.length
  const compliantStaff = staffDetail.filter(s => s.isCompliant).length
  const complianceRate = totalStaff > 0 ? Math.round((compliantStaff / totalStaff) * 100) : 0

  // Unvana göre grupla
  const byUnvanMap = new Map<string, { total: number; compliant: number }>()
  for (const s of staffDetail) {
    const key = s.unvan ?? 'Belirtilmemiş'
    const entry = byUnvanMap.get(key) ?? { total: 0, compliant: 0 }
    entry.total++
    if (s.isCompliant) entry.compliant++
    byUnvanMap.set(key, entry)
  }
  const byUnvan = Array.from(byUnvanMap.entries()).map(([unvan, v]) => ({
    unvan,
    total: v.total,
    compliant: v.compliant,
    rate: v.total > 0 ? Math.round((v.compliant / v.total) * 100) : 0,
  }))

  // Departmana göre
  const byDeptMap = new Map<string, { total: number; compliant: number }>()
  for (const s of staffDetail) {
    const key = s.department ?? 'Belirtilmemiş'
    const entry = byDeptMap.get(key) ?? { total: 0, compliant: 0 }
    entry.total++
    if (s.isCompliant) entry.compliant++
    byDeptMap.set(key, entry)
  }
  const byDepartment = Array.from(byDeptMap.entries()).map(([department, v]) => ({
    department,
    total: v.total,
    compliant: v.compliant,
    rate: v.total > 0 ? Math.round((v.compliant / v.total) * 100) : 0,
  }))

  return jsonResponse(
    {
      generatedAt: new Date().toISOString(),
      period: period
        ? { name: period.name, startDate: period.startDate, endDate: period.endDate }
        : { name: 'Özel Tarih Aralığı', startDate: rangeStart, endDate: rangeEnd },
      organizationName: organization?.name ?? '',
      summary: {
        totalStaff,
        compliantStaff,
        complianceRate,
        pendingApprovals: pendingCount,
        byUnvan,
        byDepartment,
      },
      staffDetail,
    },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
  )
}
