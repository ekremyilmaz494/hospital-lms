import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination, checkWritePermission } from '@/lib/api-helpers'
import { createUserSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { maskeTcNo } from '@/lib/utils'
import { encrypt, safeDecryptTcNo } from '@/lib/crypto'
import { logger } from '@/lib/logger'
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
      ]
    }
    if (department) where.department = department
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
        include: { _count: { select: { users: true } } },
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
      // KVKK: TC No maskeleme — sadece son 4 hane göster
      tcNo: maskeTcNo(safeDecryptTcNo(s.tcNo)),
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

  const supabase = await createServiceClient()
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      role: 'staff',
      organization_id: dbUser!.organizationId!,
    },
  })

  if (authError) {
    logger.error('Admin Staff', 'Supabase auth kullanıcı oluşturulamadı', authError.message)
    let safeMsg = 'Kullanıcı oluşturulamadı'
    if (authError.message?.includes('already registered')) safeMsg = 'Bu e-posta adresi zaten kayıtlı'
    else if (authError.message?.includes('invalid format') || authError.message?.includes('validate email')) safeMsg = 'Geçersiz e-posta adresi. Türkçe karakter (ş, ç, ğ, ü, ö, ı) kullanmayın.'
    else if (authError.message?.includes('password')) safeMsg = 'Şifre gereksinimleri karşılanmıyor'
    return errorResponse(safeMsg)
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

  let user
  try {
    user = await prisma.user.create({
      data: {
        id: authUser.user.id,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: 'staff',
        organizationId: dbUser!.organizationId!,
        tcNo: parsed.data.tcNo ? encrypt(parsed.data.tcNo) : undefined,
        phone: parsed.data.phone,
        departmentId: parsed.data.departmentId,
        title: parsed.data.title,
      },
    })
  } catch (dbError) {
    // Rollback: delete Supabase auth user if DB insert fails
    try {
      await supabase.auth.admin.deleteUser(authUser.user.id)
    } catch (rollbackError) {
      logger.error('Admin Staff', 'Rollback başarısız — orphan auth user', { userId: authUser.user.id, rollbackError })
      // Retry once
      try {
        await supabase.auth.admin.deleteUser(authUser.user.id)
      } catch {
        logger.error('Admin Staff', 'Rollback yeniden deneme başarısız — manuel temizlik gerekli', { userId: authUser.user.id })
      }
    }
    logger.error('Admin Staff', 'DB insert başarısız', dbError)
    const prismaErr = dbError as { code?: string; meta?: { target?: string[]; modelName?: string } }
    if (prismaErr.code === 'P2002') {
      const targets = prismaErr.meta?.target ?? []
      if (targets.some(t => t.includes('tc_no'))) return errorResponse('Bu TC Kimlik No ile kayıtlı bir personel zaten mevcut')
      if (targets.some(t => t.includes('email'))) return errorResponse('Bu e-posta adresi ile kayıtlı bir personel zaten mevcut')
      return errorResponse('Bu bilgilerle kayıtlı bir personel zaten mevcut')
    }
    return errorResponse('Personel veritabanına kaydedilemedi. Lütfen tekrar deneyin.')
  }

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

  return jsonResponse(user, 201)
}
