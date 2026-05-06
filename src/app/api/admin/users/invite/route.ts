import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError, getAppUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { inviteAdminSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { sendInvitationEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import {
  generateInvitationToken,
  computeInvitationExpiry,
  buildInvitationUrl,
  INVITATION_TTL_HOURS,
} from '@/lib/invitations'

/**
 * POST /api/admin/users/invite
 *
 * Esas Yönetici (org owner) yeni admin davet eder — link tabanlı (Slack/Linear pattern).
 * - Yalnız `Organization.ownerUserId === dbUser.id` olan user erişir
 * - Sıradan admin'ler 403
 * - Mevcut admin sayısı `maxAdmins`'e ulaşmışsa 409
 * - Auth user yaratılmaz, sadece Invitation token kaydedilir + email gönderilir
 * - Davet edilen kişi /davet/[token] linkine tıklayıp şifresini kurar
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
    select: { id: true, name: true, ownerUserId: true, maxAdmins: true, brandColor: true },
  })
  if (!org) throw new ApiError('Organizasyon bulunamadı', 404)

  if (org.ownerUserId !== dbUser.id) {
    return errorResponse('Bu işlem yalnızca Esas Yönetici tarafından yapılabilir', 403)
  }

  // Mevcut admin sayısı + bekleyen davet sayısı limit kontrolü
  const [adminCount, pendingInvites, existingUser] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, role: 'admin', isActive: true } }),
    prisma.invitation.count({
      where: {
        organizationId: orgId,
        role: 'admin',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
  ])

  if (existingUser) {
    return errorResponse('Bu e-posta adresi zaten sistemde kayıtlı', 409)
  }

  if (adminCount + pendingInvites >= org.maxAdmins) {
    return errorResponse(
      `Yönetici limiti dolu (${org.maxAdmins}). Aktif: ${adminCount}, bekleyen davet: ${pendingInvites}. Limit yükseltmek için Klinova ile iletişime geçin.`,
      409,
    )
  }

  // Aynı email için aktif davet varsa: eski davetleri revoke et, yeni davet oluştur (resend benzeri)
  await prisma.invitation.updateMany({
    where: {
      organizationId: orgId,
      email: parsed.data.email,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })

  // Token üret + Invitation row oluştur
  const { raw, hash } = generateInvitationToken()
  const expiresAt = computeInvitationExpiry()

  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: hash,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
      title: parsed.data.title ?? null,
      role: 'admin',
      organizationId: orgId,
      invitedByUserId: dbUser.id,
      setAsOwner: false,
      expiresAt,
    },
    select: { id: true },
  })

  await audit({
    action: 'invitation.create',
    entityType: 'invitation',
    entityId: invitation.id,
    newData: {
      email: parsed.data.email,
      role: 'admin',
      expiresAt,
    },
  })

  // Davet maili gönder
  const inviteUrl = buildInvitationUrl(getAppUrl(), raw)
  let emailSent = true
  try {
    emailSent = await sendInvitationEmail({
      to: parsed.data.email,
      organizationName: org.name,
      brandColor: org.brandColor,
      inviteUrl,
      inviterName: `${dbUser.firstName} ${dbUser.lastName}`,
      recipientName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      roleLabel: 'Yönetici',
      expiresInHours: INVITATION_TTL_HOURS,
      organizationId: orgId,
    })
  } catch (err) {
    emailSent = false
    logger.error('Admin Invite', 'Davet maili gönderilemedi', {
      email: parsed.data.email,
      error: (err as Error).message,
    })
  }

  return jsonResponse(
    {
      id: invitation.id,
      email: parsed.data.email,
      expiresAt,
      emailSent,
      // SMTP arızası fallback'i: davet eden link'i manuel paylaşabilsin
      ...(emailSent ? {} : { inviteUrl }),
    },
    201,
  )
}, { requireOrganization: true })
