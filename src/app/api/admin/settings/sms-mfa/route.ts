import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
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

export const GET = withAdminRoute(async ({ organizationId }) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { smsMfaEnabled: true, smsMfaEnforcedAt: true },
  })

  return jsonResponse({
    enabled: org?.smsMfaEnabled ?? false,
    enforcedAt: org?.smsMfaEnforcedAt ?? null,
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true, strict: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody<{ enabled?: unknown }>(request)
  if (!body || typeof body.enabled !== 'boolean') {
    return errorResponse('Geçersiz istek — enabled (boolean) gereklidir', 400)
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        smsMfaEnabled: body.enabled,
        // enable ediliyorsa enforcedAt'i şimdi set et, disable ediliyorsa dokunma
        ...(body.enabled ? { smsMfaEnforcedAt: new Date() } : {}),
      },
      select: { smsMfaEnabled: true, smsMfaEnforcedAt: true },
    })

    await audit({
      action: body.enabled ? 'sms_mfa_enabled' : 'sms_mfa_disabled',
      entityType: 'organization',
      entityId: organizationId,
    })

    logger.info('admin:sms-mfa', 'SMS MFA ayari guncellendi', { orgId: organizationId, enabled: body.enabled })

    return jsonResponse({ enabled: updated.smsMfaEnabled, enforcedAt: updated.smsMfaEnforcedAt })
  } catch (err) {
    logger.error('admin:sms-mfa', 'Guncelleme basarisiz', err)
    return errorResponse('Ayar kaydedilemedi', 500)
  }
}, { requireOrganization: true, strict: true })
