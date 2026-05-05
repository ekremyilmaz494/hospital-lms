import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, getAppUrl } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createUserSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { sendHospitalWelcomeEmail, sendStaffWelcomeEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export const POST = withSuperAdminRoute(async ({ request, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  if (!parsed.data.organizationId) {
    return errorResponse('organizationId zorunludur', 400)
  }

  // setAsOwner gönderildiyse: yalnızca admin role + henüz owner'ı olmayan org için izinli.
  // Ownership devri için /api/super-admin/organizations/[id]/transfer-ownership kullanılır.
  if (parsed.data.setAsOwner) {
    if (parsed.data.role !== 'admin') {
      return errorResponse('Esas Yönetici yalnızca admin rolündeki user için atanabilir', 400)
    }
    const existing = await prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: { ownerUserId: true },
    })
    if (!existing) return errorResponse('Organizasyon bulunamadı', 404)
    if (existing.ownerUserId) {
      return errorResponse(
        'Bu organizasyonun zaten bir Esas Yöneticisi var. Devir için transfer-ownership endpoint\'ini kullanın.',
        409,
      )
    }
  }

  const tempPassword = parsed.data.password || crypto.randomBytes(12).toString('base64url')

  let result
  try {
    result = await createAuthUser({
      email: parsed.data.email,
      password: tempPassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role as 'admin' | 'staff',
      organizationId: parsed.data.organizationId,
      phone: parsed.data.phone,
      title: parsed.data.title,
      mustChangePassword: !parsed.data.password,
    })
  } catch (err) {
    if (err instanceof AuthUserError) {
      logger.error('SuperAdmin Users', 'Auth kullanıcı oluşturulamadı', err.message)
      const safeMsg = err.message.includes('already registered')
        ? 'Bu e-posta adresi Supabase Auth sisteminde zaten kayıtlı'
        : err.safeMessage
      return errorResponse(safeMsg)
    }
    if (err instanceof DbUserError) {
      logger.error('SuperAdmin Users', 'DB user create başarısız — auth user rollback yapıldı', err.message)
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  // setAsOwner: aynı transaction'da org owner'ı işaretle (createAuthUser sonrası)
  if (parsed.data.setAsOwner) {
    try {
      await prisma.organization.update({
        where: { id: parsed.data.organizationId },
        data: { ownerUserId: result.dbUser.id },
      })
    } catch (err) {
      logger.error('SuperAdmin Users', 'setAsOwner update başarısız — manuel düzeltme gerekebilir', {
        userId: result.dbUser.id,
        organizationId: parsed.data.organizationId,
        error: (err as Error).message,
      })
      return errorResponse('Kullanıcı oluşturuldu ancak Esas Yönetici olarak işaretlenemedi. Lütfen ownership transfer endpoint\'ini kullanın.', 500)
    }
  }

  await audit({
    action: parsed.data.setAsOwner ? 'create.org_owner' : 'create',
    entityType: 'user',
    entityId: result.dbUser.id,
    newData: { ...result.dbUser, password: undefined, setAsOwner: parsed.data.setAsOwner ?? false },
  })

  // Hoş geldiniz e-postası — admin ve staff için ayrı template
  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { name: true },
  })
  const hospitalName = org?.name ?? ''
  const loginUrl = `${getAppUrl()}/auth/login`
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim()

  let emailSent = true
  try {
    if (parsed.data.role === 'admin') {
      await sendHospitalWelcomeEmail({
        to: parsed.data.email,
        hospitalName,
        loginUrl,
        tempPassword,
        adminName: fullName,
      })
    } else {
      await sendStaffWelcomeEmail({
        to: parsed.data.email,
        staffName: fullName,
        hospitalName,
        tempPassword,
        loginUrl,
      })
    }
  } catch (emailErr) {
    emailSent = false
    logger.error('SuperAdmin Users', 'Welcome email failed', {
      email: parsed.data.email,
      error: (emailErr as Error).message,
    })
  }

  return jsonResponse({
    ...result.dbUser,
    emailSent,
    ...(emailSent ? {} : { tempPassword }),
  }, 201)
})
