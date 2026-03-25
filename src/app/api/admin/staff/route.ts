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

  const [staff, total] = await Promise.all([
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
  ])

  return jsonResponse({ staff, total, page, limit, totalPages: Math.ceil(total / limit) })
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
        department: parsed.data.department,
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
