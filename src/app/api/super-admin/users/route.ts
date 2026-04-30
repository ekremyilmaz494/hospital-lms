import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createUserSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'

export const POST = withSuperAdminRoute(async ({ request, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  let result
  try {
    result = await createAuthUser({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role as 'admin' | 'staff',
      organizationId: parsed.data.organizationId!,
      phone: parsed.data.phone,
      title: parsed.data.title,
    })
  } catch (err) {
    if (err instanceof AuthUserError) {
      logger.error('SuperAdmin Users', 'Auth kullanıcı oluşturulamadı', err.message)
      return errorResponse(err.safeMessage)
    }
    if (err instanceof DbUserError) {
      logger.error('SuperAdmin Users', 'DB user create başarısız — auth user rollback yapıldı', err.message)
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  await audit({
    action: 'create',
    entityType: 'user',
    entityId: result.dbUser.id,
    newData: { ...result.dbUser, password: undefined },
  })

  return jsonResponse(result.dbUser, 201)
})
