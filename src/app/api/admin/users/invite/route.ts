import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError, getAppUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { inviteAdminSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import { sendHospitalWelcomeEmail } from '@/lib/email'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'

/**
 * POST /api/admin/users/invite
 *
 * Esas Yönetici (org owner) yeni admin davet eder.
 * - Yalnız `Organization.ownerUserId === dbUser.id` olan user erişir
 * - Sıradan admin'ler 403
 * - Mevcut admin sayısı `maxAdmins`'e ulaşmışsa 409
 * - createAuthUser + sendHospitalWelcomeEmail + audit
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const orgId = organizationId

  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await checkRateLimit(`admin-invite:ip:${ip}`, 20, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const body = await parseBody(request)
  if (!body) throw new ApiError('Geçersiz istek verisi', 400)

  const parsed = inviteAdminSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      maxAdmins: true,
    },
  })
  if (!org) throw new ApiError('Organizasyon bulunamadı', 404)

  if (org.ownerUserId !== dbUser.id) {
    return errorResponse('Bu işlem yalnızca Esas Yönetici tarafından yapılabilir', 403)
  }

  const adminCount = await prisma.user.count({
    where: { organizationId: orgId, role: 'admin', isActive: true },
  })
  if (adminCount >= org.maxAdmins) {
    return errorResponse(
      `Yönetici limiti dolu (${org.maxAdmins}). Limit yükseltmek için Klinova ile iletişime geçin.`,
      409,
    )
  }

  const tempPassword = 'Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1' // secret-scanner-disable-line

  let result
  try {
    result = await createAuthUser({
      email: parsed.data.email,
      password: tempPassword,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: 'admin',
      organizationId: orgId,
      phone: parsed.data.phone,
      title: parsed.data.title,
      mustChangePassword: true,
    })
  } catch (err) {
    if (err instanceof AuthUserError) {
      logger.error('Admin Invite', 'Auth kullanıcı oluşturulamadı', err.message)
      return errorResponse(err.safeMessage)
    }
    if (err instanceof DbUserError) {
      logger.error('Admin Invite', 'DB insert başarısız — rollback yapıldı', err.message)
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  const user = result.dbUser

  await audit({
    action: 'admin.invite',
    entityType: 'user',
    entityId: user.id,
    newData: { ...user, invitedByOwnerId: dbUser.id },
  })

  revalidatePath('/admin/yoneticiler')
  try { await invalidateOrgCache(orgId, 'staff') } catch { /* best-effort */ }

  let emailSent = true
  try {
    await sendHospitalWelcomeEmail({
      to: user.email,
      hospitalName: org.name,
      loginUrl: `${getAppUrl()}/auth/login`,
      tempPassword,
      adminName: `${user.firstName} ${user.lastName}`,
    })
  } catch (err) {
    emailSent = false
    logger.error('Admin Invite', 'Welcome email failed', {
      email: user.email,
      error: (err as Error).message,
    })
  }

  return jsonResponse(
    {
      ...user,
      emailSent,
      ...(emailSent ? {} : { tempPassword }),
    },
    201,
  )
}, { requireOrganization: true })
