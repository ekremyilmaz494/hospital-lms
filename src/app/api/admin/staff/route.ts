import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination, ApiError } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createUserSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import { sendStaffWelcomeEmail } from '@/lib/email'
import { checkRateLimit, withCache, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import type { AssignmentStatus } from '@/lib/exam-state-machine'
import type { UserRole } from '@/types/database'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const orgId = organizationId
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const department = searchParams.get('department')
  const isActive = searchParams.get('isActive')

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

    // 1. dalga — sayfa listesi + global stat'lar paralel
    const [staff, total, rawDepartments, activeStaff, overallAvgAgg] = await Promise.all([
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
        include: { _count: { select: { users: { where: { role: 'staff' satisfies UserRole, isActive: true } } } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true } }),
      // Tüm org için tek sayı — groupBy yerine aggregate (tek satır döner, ucuz)
      prisma.examAttempt.aggregate({
        where: { user: { organizationId: orgId, role: 'staff' satisfies UserRole }, isPassed: true },
        _avg: { postExamScore: true },
      }),
    ])

    // 2. dalga — sadece bu sayfadaki userId'ler için per-user metrikler
    const pageUserIds = staff.map(s => s.id)
    const [completedCounts, avgScores] = pageUserIds.length > 0
      ? await Promise.all([
          prisma.trainingAssignment.groupBy({
            by: ['userId'],
            where: { userId: { in: pageUserIds }, status: 'passed' satisfies AssignmentStatus },
            _count: true,
          }),
          prisma.examAttempt.groupBy({
            by: ['userId'],
            where: { userId: { in: pageUserIds }, isPassed: true },
            _avg: { postExamScore: true },
          }),
        ])
      : [[], []] as const

    const completedMap = new Map(completedCounts.map(c => [c.userId, c._count]))
    const avgScoreMap = new Map(avgScores.map(a => [a.userId, Math.round(Number(a._avg.postExamScore ?? 0))]))

    const departments = rawDepartments.map(d => ({
      id: d.id,
      name: d.name,
      color: d.color,
      description: d.description || '',
      staffCount: d._count.users,
    }))

    const overallAvgScore = Math.round(Number(overallAvgAgg._avg.postExamScore ?? 0))

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
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const orgId = organizationId

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
  if (!body) throw new ApiError('Geçersiz istek verisi', 400)

  const parsed = createUserSchema.safeParse({ ...body as object, role: 'staff', organizationId: orgId })
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
  if (parsed.data.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, organizationId: orgId },
      select: { name: true },
    })
    if (!dept) return errorResponse('Geçersiz departman — bu departman organizasyonunuza ait değil', 400)
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
      organizationId: orgId,
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

  await audit({
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    newData: user,
  })

  revalidatePath('/admin/staff')

  try { await invalidateDashboardCache(orgId) } catch { /* cache invalidation best-effort */ }
  try { await invalidateOrgCache(orgId, 'staff') } catch { /* cache invalidation best-effort */ }

  // Hoş geldiniz maili — fire-and-forget, hesap oluşumunu bloklamaz
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
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
}, { requireOrganization: true })
