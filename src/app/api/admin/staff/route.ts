import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createUserSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
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
    organizationId: dbUser!.organizationId,
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

  const departments = rawDepartments.map(d => ({
    id: d.id,
    name: d.name,
    color: d.color,
    description: d.description || '',
    staffCount: d._count.users
  }))

  const activeStaff = staff.filter(s => s.isActive).length
  // Varsayılan temsili stats
  const stats = {
    totalStaff: total,
    activeStaff,
    departmentCount: rawDepartments.length,
    avgScore: 0
  }

  // Frontend'e uyması için staff verisini map'liyoruz
  const formattedStaff = staff.map(s => ({
    id: s.id,
    name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
    email: s.email,
    tcNo: s.tcNo || '',
    department: departments.find(d => d.id === s.department)?.name || s.department || '',
    departmentId: s.department,
    title: s.title || '',
    assignedTrainings: s._count.assignments || 0,
    completedTrainings: 0,
    avgScore: 0,
    status: s.isActive ? 'Aktif' : 'Pasif',
    initials: `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase()
  }))

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
  if (!body) return errorResponse('Invalid body')

  const parsed = createUserSchema.safeParse({ ...body as object, role: 'staff', organizationId: dbUser!.organizationId })
  if (!parsed.success) return errorResponse(parsed.error.message)

  const supabase = await createServiceClient()
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      role: 'staff',
      organization_id: dbUser!.organizationId,
    },
  })

  if (authError) return errorResponse(authError.message)

  let user
  try {
    user = await prisma.user.create({
      data: {
        id: authUser.user.id,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: 'staff',
        organizationId: dbUser!.organizationId,
        tcNo: parsed.data.tcNo,
        phone: parsed.data.phone,
        departmentId: parsed.data.departmentId,
        department: parsed.data.departmentId 
          ? (await prisma.department.findUnique({ where: { id: parsed.data.departmentId } }))?.name || undefined
          : parsed.data.department,
        title: parsed.data.title,
      },
    })
  } catch (dbError) {
    // Rollback: delete Supabase auth user if DB insert fails
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return errorResponse(`Veritabanı hatası: ${dbError instanceof Error ? dbError.message : 'Bilinmeyen hata'}`)
  }

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    newData: user,
    request,
  })

  return jsonResponse(user, 201)
}
