import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { hashInvitationToken, getInvitationClaimError } from '@/lib/invitations'
import { acceptInvitationSchema } from '@/lib/validations'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { decryptTcKimlik } from '@/lib/tc-crypto'
import { autoAssignByDepartment } from '@/lib/auto-assign'

/**
 * Public davet endpoint'i — auth gerektirmez.
 *
 * GET  /api/auth/invitations/[token]  → token doğrula + form metadata (org adı, email, role)
 * POST /api/auth/invitations/[token]  → şifre + KVKK ile hesabı aktive et
 *
 * Güvenlik:
 *  - Token URL'de plaintext, DB'de SHA-256 hash karşılaştırması
 *  - Rate limit: GET 30/saat per-IP, POST 20/saat per-IP
 *  - 5 yanlış denemeden sonra invitation revoke
 *  - acceptedAt set olduktan sonra ikinci POST 410
 */

type RouteContext = { params: Promise<{ token: string }> }

function ipFromRequest(req: NextRequest): string {
  return req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown'
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const ip = ipFromRequest(request)
  const allowed = await checkRateLimit(`inv-verify:ip:${ip}`, 30, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const { token } = await params
  if (!token || token.length < 10) {
    return errorResponse('Geçersiz davet bağlantısı', 410)
  }

  const tokenHash = hashInvitationToken(token)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      attemptCount: true,
      setAsOwner: true,
      organization: {
        select: { id: true, name: true, brandColor: true, logoUrl: true },
      },
    },
  })

  if (!invitation) {
    return errorResponse('Davet bulunamadı veya geçersiz', 410)
  }

  const claimError = getInvitationClaimError(invitation)
  if (claimError) {
    return errorResponse(claimError, 410)
  }

  // Single-use token: cache yasak (claim sonrası eski state'i serve etmesin)
  return jsonResponse({
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    role: invitation.role,
    setAsOwner: invitation.setAsOwner,
    expiresAt: invitation.expiresAt,
    organization: invitation.organization,
  }, 200, { 'Cache-Control': 'no-store' })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const ip = ipFromRequest(request)
  const allowed = await checkRateLimit(`inv-accept:ip:${ip}`, 20, 3600)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Çok fazla istek gönderdiniz. Lütfen 60 dakika sonra tekrar deneyin.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }

  const { token } = await params
  if (!token || token.length < 10) {
    return errorResponse('Geçersiz davet bağlantısı', 410)
  }

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi', 400)

  const parsed = acceptInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }

  const tokenHash = hashInvitationToken(token)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      title: true,
      role: true,
      organizationId: true,
      departmentId: true,
      setAsOwner: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      attemptCount: true,
      // Davet anında alınan TC (encrypted) — kabul edildiğinde User'a kopyalanır
      tcEncrypted: true,
      invitedByUserId: true,
    },
  })

  if (!invitation) {
    return errorResponse('Davet bulunamadı veya geçersiz', 410)
  }

  const claimError = getInvitationClaimError(invitation)
  if (claimError) {
    return errorResponse(claimError, 410)
  }

  // role validation (sadece admin/staff kabul edilir)
  if (invitation.role !== 'admin' && invitation.role !== 'staff') {
    logger.error('invitations', 'Geçersiz role değeriyle Invitation kaydı', { id: invitation.id, role: invitation.role })
    return errorResponse('Davet kaydında hata var. Lütfen yeni bir davet talep edin.', 500)
  }

  // Race-safe acceptance: önce acceptedAt'i set et (single-use lock).
  // updateMany ile atomik koşullu update — başkası bizden önce kabul etmişse rowsAffected=0
  const lockResult = await prisma.invitation.updateMany({
    where: {
      id: invitation.id,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { acceptedAt: new Date() },
  })

  if (lockResult.count === 0) {
    return errorResponse('Bu davet az önce kullanıldı veya iptal edildi.', 410)
  }

  // maxAdmins re-check (admin daveti için)
  if (invitation.role === 'admin') {
    const org = await prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { maxAdmins: true },
    })
    const adminCount = await prisma.user.count({
      where: { organizationId: invitation.organizationId, role: 'admin', isActive: true },
    })
    if (org && adminCount >= org.maxAdmins && !invitation.setAsOwner) {
      // Davet kullanılamadı — kilitlemeyi geri al
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: null, revokedAt: new Date() },
      })
      return errorResponse(`Yönetici limiti dolu (${org.maxAdmins}). Lütfen Esas Yönetici ile iletişime geçin.`, 409)
    }
  }

  // Davet anında alınan TC'yi (varsa) çöz → createAuthUser yeniden encrypt + hash atar.
  // KVKK: plaintext TC sadece bu request'in lifetime'ı içinde memory'de yaşar.
  // Decrypt başarısız olursa (örn. ENCRYPTION_KEY rotation sonrası) TC'siz devam eder;
  // davet edilen kişi profilinden sonra ekleyebilir.
  let plainTcFromInvitation: string | undefined
  if (invitation.tcEncrypted) {
    try {
      plainTcFromInvitation = decryptTcKimlik(invitation.tcEncrypted)
    } catch (err) {
      logger.warn('invitations.accept', 'Davet TC decrypt başarısız — TC olmadan devam', err instanceof Error ? err.message : err)
    }
  }

  // createAuthUser ile auth + db user oluştur
  let result
  try {
    result = await createAuthUser({
      email: invitation.email,
      password: parsed.data.password,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      role: invitation.role,
      organizationId: invitation.organizationId,
      phone: invitation.phone ?? undefined,
      title: invitation.title ?? undefined,
      departmentId: invitation.departmentId ?? null,
      mustChangePassword: false,
      isActive: true,
      // TC (davetten gelir) — createAuthUser encrypt + hash atar, User'a yazar
      tcKimlik: plainTcFromInvitation,
      tcAddedByUserId: invitation.invitedByUserId ?? undefined,
    })
  } catch (err) {
    // User oluşturulamadı — kilidi aç (kullanıcı yeniden deneyebilsin)
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: null, attemptCount: { increment: 1 } },
    })

    if (err instanceof AuthUserError) {
      logger.error('invitations.accept', 'Auth user oluşturulamadı', err.message)
      return errorResponse(err.safeMessage)
    }
    if (err instanceof DbUserError) {
      logger.error('invitations.accept', 'DB insert başarısız', err.message)
      return errorResponse(err.safeMessage)
    }
    logger.error('invitations.accept', 'Beklenmeyen hata', err)
    return errorResponse('Hesap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
  }

  const newUser = result.dbUser

  // Post-create işlemler (best-effort, başarısız olursa user yine aktif)
  await Promise.all([
    // KVKK onayını işle (formda mecburi checkbox onaylanmış olarak geldi)
    prisma.user.update({
      where: { id: newUser.id },
      data: {
        kvkkNoticeAcknowledgedAt: new Date(),
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      },
    }).catch(err => logger.error('invitations.accept', 'KVKK update başarısız', err)),

    // Invitation kaydında acceptedUserId set
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedUserId: newUser.id },
    }).catch(err => logger.error('invitations.accept', 'acceptedUserId update başarısız', err)),

    // setAsOwner=true ise organization.ownerUserId set (yalnız NULL ise — race-safe)
    invitation.setAsOwner
      ? prisma.organization.updateMany({
          where: { id: invitation.organizationId, ownerUserId: null },
          data: { ownerUserId: newUser.id },
        }).catch(err => logger.error('invitations.accept', 'ownerUserId update başarısız', err))
      : Promise.resolve(),

    // Audit log (organization-scoped) — hash zincirine dahil olsun diye createAuditLog
    // (kendi hatasını yutar; ip/userAgent'i request'ten otomatik doldurur).
    createAuditLog({
      userId: newUser.id,
      organizationId: invitation.organizationId,
      action: 'invitation.accept',
      entityType: 'user',
      entityId: newUser.id,
      newData: { invitationId: invitation.id, setAsOwner: invitation.setAsOwner },
      request,
    }),
  ])

  // Departman eğitim kurallarına göre otomatik atama (best-effort, sadece staff için)
  if (invitation.role === 'staff' && invitation.departmentId) {
    try {
      await autoAssignByDepartment(
        newUser.id,
        invitation.departmentId,
        invitation.organizationId,
        invitation.invitedByUserId ?? undefined,
      )
    } catch (err) {
      logger.warn('invitations.accept', 'autoAssignByDepartment basarisiz', err instanceof Error ? err.message : err)
    }
  }

  // Rol-bazlı yönlendirme — accept-form login'e değil direkt panele gitsin.
  // Login akışı middleware tarafında zaten Supabase session'ını kuracak.
  const redirectTo = invitation.role === 'staff' ? '/staff' : '/admin'

  return jsonResponse({
    success: true,
    email: newUser.email,
    role: invitation.role,
    redirectTo,
  }, 201)
}
