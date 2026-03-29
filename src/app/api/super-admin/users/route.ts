import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createUserSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  // Create auth user via service role
  const supabase = await createServiceClient()
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      role: parsed.data.role,
      organization_id: parsed.data.organizationId,
    },
  })

  if (authError) {
    logger.error('SuperAdmin Users', 'Supabase auth kullanıcı oluşturulamadı', authError.message)
    const safeMsg = authError.message?.includes('already registered')
      ? 'Bu e-posta adresi zaten kayıtlı'
      : 'Kullanıcı oluşturulamadı'
    return errorResponse(safeMsg)
  }

  // Create DB user record — rollback auth user if DB fails
  let user
  try {
    user = await prisma.user.create({
      data: {
        id: authUser.user.id,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: parsed.data.role,
        organizationId: parsed.data.organizationId,
        tcNo: parsed.data.tcNo,
        phone: parsed.data.phone,
        title: parsed.data.title,
      },
    })
  } catch (dbError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return errorResponse(`Veritabanı hatası: ${dbError instanceof Error ? dbError.message : 'Bilinmeyen hata'}`)
  }

  await createAuditLog({
    userId: dbUser!.id,
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    newData: { ...user, password: undefined },
    request,
  })

  return jsonResponse(user, 201)
}
