import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination, checkWritePermission } from '@/lib/api-helpers'
import { createUserSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import { sendStaffWelcomeEmail } from '@/lib/email'
import { checkRateLimit, withCache, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const department = searchParams.get('department')
  const isActive = searchParams.get('isActive')

  const orgId = dbUser!.organizationId!
  const cacheKey = `cache:${orgId}:staff:${page}:${limit}:${search}:${department || ''}:${isActive || ''}`

  const data = await withCache(cacheKey, 120, async () => {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      role: 'staff',
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (department) where.departmentId = department
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

    // Tek dalgalı Promise.all — tüm sorgular paralel
    const [staff, total, rawDepartments, activeStaff, completedCounts, avgScores] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: { select: { assignments: true, examAttempts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.department.findMany({
        where: { organizationId: orgId },
        include: { _count: { select: { users: { where: { role: 'staff', isActive: true } } } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
      prisma.trainingAssignment.groupBy({
        by: ['userId'],
        where: { user: { organizationId: orgId, role: 'staff' }, status: 'passed' },
        _count: true,
      }),
      prisma.examAttempt.groupBy({
        by: ['userId'],
        where: { user: { organizationId: orgId, role: 'staff' }, isPassed: true },
        _avg: { postExamScore: true },
      }),
    ])

    const completedMap = new Map(completedCounts.map(c => [c.userId, c._count]))
    const avgScoreMap = new Map(avgScores.map(a => [a.userId, Math.round(Number(a._avg.postExamScore ?? 0))]))

    const departments = rawDepartments.map(d => ({
      id: d.id,
      name: d.name,
      color: d.color,
      description: d.description || '',
      staffCount: d._count.users,
    }))

    // Overall avg score (tüm org için)
    const allAvgScores = avgScores.map(a => Number(a._avg.postExamScore ?? 0)).filter(s => s > 0)
    const overallAvgScore = allAvgScores.length > 0
      ? Math.round(allAvgScores.reduce((sum, sc) => sum + sc, 0) / allAvgScores.length)
      : 0

    const stats = {
      totalStaff: total,
      activeStaff,
      departmentCount: rawDepartments.length,
      avgScore: overallAvgScore
    }

    const formattedStaff = staff.map(s => ({
      id: s.id,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
      email: s.email,
      department: departments.find(d => d.id === s.departmentId)?.name || '',
      departmentId: s.departmentId,
      title: s.title || '',
      assignedTrainings: s._count.assignments || 0,
      completedTrainings: completedMap.get(s.id) ?? 0,
      avgScore: avgScoreMap.get(s.id) ?? 0,
      status: s.isActive ? 'Aktif' : 'Pasif',
      initials: `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase()
    }))

    return { staff: formattedStaff, departments, stats, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

  return jsonResponse(
    data,
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const writeBlock = await checkWritePermission(dbUser!.organizationId!, 'POST')
  if (writeBlock) return writeBlock

  // IP bazlı rate limit: 50 oluşturma / 1 saat
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await checkRateLimit(`staff-create:ip:${ip}`, 50, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = createUserSchema.safeParse({ ...body as object, role: 'staff', organizationId: dbUser!.organizationId! })
  if (!parsed.success) {
    logger.error('Admin Staff', 'Validation failed', parsed.error.issues)
    const msg = parsed.error.issues.map(i => {
      const field = i.path.join('.')
      if (field === 'email') return 'Geçerli bir e-posta adresi girin'
      if (field === 'password') return 'Şifre en az 8 karakter olmalıdır'
      if (field === 'firstName') return 'Ad zorunludur'
      if (field === 'lastName') return 'Soyad zorunludur'
      if (field === 'departmentId') return 'Geçersiz departman seçimi'
      if (field === 'organizationId') return 'Organizasyon hatası — lütfen tekrar giriş yapın'
      return i.message
    }).join(', ')
    return errorResponse(msg)
  }

  // B4.2/G4.2 — Cross-tenant departman kontrolü: departmentId bu organizasyona ait olmalı
  let resolvedDeptName: string | undefined = parsed.data.department
  if (parsed.data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, organizationId: dbUser!.organizationId! },
      select: { name: true },
    })
    if (!dept) return errorResponse('Geçersiz departman — bu departman organizasyonunuza ait değil', 400)
    resolvedDeptName = dept.name
  }

  // Şifre opsiyonel — boş gelirse güvenli şifre üret (mail ile personele gönderilecek)
  const effectivePassword = parsed.data.password ||
    ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1')

  let result
  try {
    result = await createAuthUser({
      email: parsed.data.email,
      password: effectivePassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: 'staff',
      organizationId: dbUser!.organizationId!,
      phone: parsed.data.phone,
      departmentId: parsed.data.departmentId,
      title: parsed.data.title,
      mustChangePassword: true,
    })
  } catch (err) {
    if (err instanceof AuthUserError) {
      logger.error('Admin Staff', 'Auth kullanıcı oluşturulamadı', err.message)
      return errorResponse(err.safeMessage)
    }
    if (err instanceof DbUserError) {
      logger.error('Admin Staff', 'DB insert başarısız — rollback yapıldı', err.message)
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  const user = result.dbUser

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    newData: user,
    request,
  })

  revalidatePath('/admin/staff')

  try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}
  try { await invalidateOrgCache(dbUser!.organizationId!, 'staff') } catch {}

  // Hoş geldiniz maili — fire-and-forget, hesap oluşumunu bloklamaz
  try {
    const org = await prisma.organization.findUnique({
      where: { id: dbUser!.organizationId! },
      select: { name: true },
    })
    await sendStaffWelcomeEmail({
      to: user.email,
      staffName: `${user.firstName} ${user.lastName}`,
      hospitalName: org?.name ?? 'Hastane',
      tempPassword: effectivePassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/login`,
    })
  } catch (err) {
    logger.warn('Admin Staff', `Hoş geldiniz maili gönderilemedi: ${user.email}`, err instanceof Error ? err.message : err)
  }

  return jsonResponse(user, 201)
}
