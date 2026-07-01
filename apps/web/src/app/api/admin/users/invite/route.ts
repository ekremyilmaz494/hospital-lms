import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError, getOrgUrl } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { inviteAdminSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { maskEmail } from '@/lib/pii-mask'
import { sendInvitationEmail, sendStaffWelcomeEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import {
  generateInvitationToken,
  computeInvitationExpiry,
  buildInvitationUrl,
  INVITATION_TTL_HOURS,
} from '@/lib/invitations'
import { encryptTcKimlik, hashTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'

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

  // mode default 'invite' — eski client'lar mode göndermiyorsa otomatik invite'a düşer
  const rawBody = body as Record<string, unknown>
  if (!rawBody.mode) rawBody.mode = 'invite'

  const parsed = inviteAdminSchema.safeParse(rawBody)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }
  const data = parsed.data

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true, ownerUserId: true, maxAdmins: true, brandColor: true },
  })
  if (!org) throw new ApiError('Organizasyon bulunamadı', 404)

  if (org.ownerUserId !== dbUser.id) {
    return errorResponse('Bu işlem yalnızca Esas Yönetici tarafından yapılabilir', 403)
  }

  // TC hash'i — duplicate kontrolü ve Invitation/User'a yazım için (org scope'lu)
  const tcHash = hashTcKimlik(data.tcKimlik)

  // Mevcut admin sayısı + bekleyen davet sayısı limit kontrolü + TC duplicate
  const [adminCount, pendingInvites, existingUser, existingTcUser] = await Promise.all([
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
    data.email ? prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }) : Promise.resolve(null),
    // TEK-ORG: TC global aranır — başka kuruma kayıtlıysa da reddedilir.
    prisma.user.findFirst({
      where: { tcHash },
      select: { id: true, organizationId: true },
    }),
  ])

  if (existingUser) {
    return errorResponse('Bu e-posta adresi zaten sistemde kayıtlı', 409)
  }

  if (existingTcUser) {
    return errorResponse(
      existingTcUser.organizationId === orgId
        ? 'Bu TC Kimlik No ile bu kurumda zaten kayıtlı bir kullanıcı var'
        : 'Bu TC Kimlik No başka bir kuruma kayıtlı. Bir kişi yalnızca bir kuruma bağlı olabilir.',
      409,
    )
  }

  if (adminCount + pendingInvites >= org.maxAdmins) {
    return errorResponse(
      `Yönetici limiti dolu (${org.maxAdmins}). Aktif: ${adminCount}, bekleyen davet: ${pendingInvites}. Limit yükseltmek için Klinova ile iletişime geçin.`,
      409,
    )
  }

  // ── DIRECT MODE — sistem geçici şifre üretir, hesap anında açılır ─────────
  // Esas Yönetici admin'i elden teslim ile yönetir (PDF basıp kapalı zarfla verir).
  // mustChangePassword=true → ilk girişte zorla şifre değiştirme.
  if (data.mode === 'direct') {
    const effectivePassword = data.password ||
      ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1')
    const effectiveEmail = data.email ?? `noemail-${hashTcKimlik(data.tcKimlik).slice(0, 12)}@klinovax.internal`

    let result
    try {
      result = await createAuthUser({
        email: effectiveEmail,
        password: effectivePassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'admin',
        organizationId: orgId,
        phone: data.phone,
        title: data.title,
        mustChangePassword: true,
        tcKimlik: data.tcKimlik,
        tcAddedByUserId: dbUser.id,
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

    const newUser = result.dbUser

    await audit({
      action: 'create',
      entityType: 'user',
      entityId: newUser.id,
      newData: {
        email: newUser.email,
        role: 'admin',
        mode: 'direct',
        tcAuditRef: tcAuditRef(data.tcKimlik),
      },
    })

    // Hoş geldiniz maili — best effort. Email yoksa ya da gönderilemezse PDF akışı devreye girer.
    let welcomeEmailSent = true
    try {
      await sendStaffWelcomeEmail({
        to: newUser.email,
        staffName: `${newUser.firstName} ${newUser.lastName}`,
        organizationName: org.name,
        brandColor: org.brandColor,
        tempPassword: effectivePassword,
        // Davet edilen admin doğrudan kendi hastane subdomain'ine gitsin
        loginUrl: `${getOrgUrl(org.slug)}/auth/login`,
      })
    } catch (err) {
      welcomeEmailSent = false
      logger.warn('Admin Invite', `Hoş geldiniz maili gönderilemedi: ${maskEmail(newUser.email)}`, err instanceof Error ? err.message : err)
    }

    return jsonResponse(
      {
        mode: 'direct',
        userId: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        emailSent: welcomeEmailSent,
        // Geçici şifre — admin manuel teslim için her durumda dön (mail gitse bile PDF basabilir)
        tempPassword: effectivePassword,
        // TC echo — frontend PDF üretimi için
        tcKimlik: data.tcKimlik,
      },
      201,
    )
  }

  // ── INVITE MODE — davet linki gönder, hesap kabul anında oluşur (mevcut akış) ──

  // Aynı email için aktif davet varsa: eski davetleri revoke et, yeni davet oluştur (resend benzeri)
  await prisma.invitation.updateMany({
    where: {
      organizationId: orgId,
      email: data.email,
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
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      title: data.title ?? null,
      role: 'admin',
      organizationId: orgId,
      invitedByUserId: dbUser.id,
      setAsOwner: false,
      expiresAt,
      // KVKK: ham TC sadece bu noktaya kadar; encrypt + hash şifrelenmiş hali yazılır
      tcEncrypted: encryptTcKimlik(data.tcKimlik),
      tcHash,
    },
    select: { id: true },
  })

  await audit({
    action: 'invitation.create',
    entityType: 'invitation',
    entityId: invitation.id,
    newData: {
      email: data.email,
      role: 'admin',
      mode: 'invite',
      expiresAt,
      // Plaintext TC YAZILMAZ; sadece hash prefix referansı (KVKK denetim kanıtı)
      tcAuditRef: tcAuditRef(data.tcKimlik),
    },
  })

  // Davet maili gönder — token tenant subdomain'inde aktive edilir,
  // accept sonrası kullanıcı zaten doğru subdomain'de admin panel'ine düşer.
  const inviteUrl = buildInvitationUrl(getOrgUrl(org.slug), raw)
  let emailSent = true
  try {
    emailSent = await sendInvitationEmail({
      to: data.email,
      organizationName: org.name,
      brandColor: org.brandColor,
      inviteUrl,
      inviterName: `${dbUser.firstName} ${dbUser.lastName}`,
      recipientName: `${data.firstName} ${data.lastName}`,
      roleLabel: 'Yönetici',
      expiresInHours: INVITATION_TTL_HOURS,
      organizationId: orgId,
    })
  } catch (err) {
    emailSent = false
    logger.error('Admin Invite', 'Davet maili gönderilemedi', {
      email: data.email,
      error: (err as Error).message,
    })
  }

  return jsonResponse(
    {
      mode: 'invite',
      id: invitation.id,
      email: data.email,
      expiresAt,
      emailSent,
      // SMTP arızası fallback'i: davet eden link'i manuel paylaşabilsin
      ...(emailSent ? {} : { inviteUrl }),
    },
    201,
  )
}, { requireOrganization: true })
