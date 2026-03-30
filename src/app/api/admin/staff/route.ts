import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createUserSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const department = searchParams.get('department')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
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

  const [staff, total, rawDepartments] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        _count: { select: { assignments: true, examAttempts: true } },
        assignments: {
          select: {
            status: true,
            examAttempts: {
              where: { isPassed: true },
              select: { postExamScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
    prisma.department.findMany({
      where: { organizationId: dbUser!.organizationId! },
      include: { _count: { select: { users: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const deptMap = new Map(rawDepartments.map(d => [d.id, d.name]))


  const departments = rawDepartments.map(d => ({
    id: d.id,
    name: d.name,
    color: d.color,
    description: d.description || '',
    staffCount: d._count.users,
  }))

  const activeStaff = staff.filter(s => s.isActive).length

  // Calculate overall avgScore from all passed exam attempts in the org
  const allPassedScores = staff
    .flatMap(s => s.assignments)
    .flatMap(a => a.examAttempts)
    .map(e => Number(e.postExamScore))
    .filter(score => !isNaN(score) && score > 0)
  const overallAvgScore = allPassedScores.length > 0
    ? Math.round(allPassedScores.reduce((sum, sc) => sum + sc, 0) / allPassedScores.length)
    : 0

  const stats = {
    totalStaff: total,
    activeStaff,
    departmentCount: rawDepartments.length,
    avgScore: overallAvgScore
  }

  // Frontend'e uyması için staff verisini map'liyoruz
  const formattedStaff = staff.map(s => {
    const completedTrainings = s.assignments.filter(a => a.status === 'passed').length
    const passedScores = s.assignments
      .flatMap(a => a.examAttempts)
      .map(e => Number(e.postExamScore))
      .filter(score => !isNaN(score) && score > 0)
    const avgScore = passedScores.length > 0
      ? Math.round(passedScores.reduce((sum, sc) => sum + sc, 0) / passedScores.length)
      : 0

    return {
      id: s.id,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
      email: s.email,
      // KVKK: TC No maskeleme — sadece son 4 hane göster
      tcNo: s.tcNo ? `*******${s.tcNo.slice(-4)}` : '',
      department: departments.find(d => d.id === s.departmentId)?.name || '',
      departmentId: s.departmentId,
      title: s.title || '',
      assignedTrainings: s._count.assignments || 0,
      completedTrainings,
      avgScore,
      status: s.isActive ? 'Aktif' : 'Pasif',
      initials: `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase()
    }
  })

  return jsonResponse({ staff: formattedStaff, departments, stats, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Rate limit: admin başına dakikada 5 personel oluşturma
  const allowed = await checkRateLimit(`staff-create:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = createUserSchema.safeParse({ ...body as object, role: 'staff', organizationId: dbUser!.organizationId! })
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => {
      const field = i.path.join('.')
      if (field === 'email') return 'Geçerli bir e-posta adresi girin'
      if (field === 'password') return 'Şifre en az 8 karakter olmalıdır'
      if (field === 'firstName') return 'Ad zorunludur'
      if (field === 'lastName') return 'Soyad zorunludur'
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
        tcNo: parsed.data.tcNo,
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

  return jsonResponse(user, 201)
}
