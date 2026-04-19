import { jsonResponse, errorResponse, getAuthUser, parseBody, requireRole, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * GET  /api/admin/settings/sms-mfa — mevcut ayarı oku
 * POST /api/admin/settings/sms-mfa — ayarı güncelle  Body: { enabled: boolean }
 *
 * Sadece hastane admin'i org seviyesinde SMS MFA'yı aç/kapat edebilir.
 * smsMfaEnforcedAt enable edildiği anda set edilir — eski kullanıcıları
 * graceful bilgilendirmek için tarih referansı olur.
 */

export async function GET() {
  const { user, dbUser, error } = await getAuthUser()
  if (error) return error
  if (!user || !dbUser) return errorResponse('Oturum bulunamadı', 401)

  const roleErr = requireRole(dbUser.role, ['admin'])
  if (roleErr) return roleErr

  if (!dbUser.organizationId) return errorResponse('Organizasyon bulunamadı', 404)

  const org = await prisma.organization.findUnique({
    where: { id: dbUser.organizationId },
    select: { smsMfaEnabled: true, smsMfaEnforcedAt: true },
  })

  return jsonResponse({
    enabled: org?.smsMfaEnabled ?? false,
    enforcedAt: org?.smsMfaEnforcedAt ?? null,
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}

export async function POST(request: Request) {
  const { user, dbUser, error } = await getAuthUser()
  if (error) return error
  if (!user || !dbUser) return errorResponse('Oturum bulunamadı', 401)

  const roleErr = requireRole(dbUser.role, ['admin'])
  if (roleErr) return roleErr

  if (!dbUser.organizationId) return errorResponse('Organizasyon bulunamadı', 404)

  const body = await parseBody<{ enabled?: unknown }>(request)
  if (!body || typeof body.enabled !== 'boolean') {
    return errorResponse('Geçersiz istek — enabled (boolean) gereklidir', 400)
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: dbUser.organizationId },
      data: {
        smsMfaEnabled: body.enabled,
        // enable ediliyorsa enforcedAt'i şimdi set et, disable ediliyorsa dokunma
        ...(body.enabled ? { smsMfaEnforcedAt: new Date() } : {}),
      },
      select: { smsMfaEnabled: true, smsMfaEnforcedAt: true },
    })

    await createAuditLog({
      userId: user.id,
      organizationId: dbUser.organizationId,
      action: body.enabled ? 'sms_mfa_enabled' : 'sms_mfa_disabled',
      entityType: 'organization',
      entityId: dbUser.organizationId,
      request,
    }).catch(() => {})

    logger.info('admin:sms-mfa', 'SMS MFA ayari guncellendi', { orgId: dbUser.organizationId, enabled: body.enabled })

    return jsonResponse({ enabled: updated.smsMfaEnabled, enforcedAt: updated.smsMfaEnforcedAt })
  } catch (err) {
    logger.error('admin:sms-mfa', 'Guncelleme basarisiz', err)
    return errorResponse('Ayar kaydedilemedi', 500)
  }
}
