import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { z } from 'zod/v4'
import { encrypt } from '@/lib/crypto'
import { invalidateOrgTransporter } from '@/lib/email'
import { logger } from '@/lib/logger'

const smtpSchema = z.object({
  smtpHost: z.string().min(1).max(255).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1).max(255).optional().nullable(),
  smtpPassword: z.string().min(1).max(500).optional().nullable(),
  smtpFrom: z.string().max(320).optional().nullable(),
  smtpReplyTo: z.string().max(320).optional().nullable(),
  smtpEnabled: z.boolean().optional(),
})

/** GET — SMTP config (şifre DÖNDÜRÜLMEZ, sadece hasPassword) */
export async function GET() {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassEncrypted: true,
      smtpFrom: true,
      smtpReplyTo: true,
      smtpEnabled: true,
    },
  })

  return jsonResponse({
    smtpHost: org?.smtpHost ?? '',
    smtpPort: org?.smtpPort ?? 587,
    smtpSecure: org?.smtpSecure ?? false,
    smtpUser: org?.smtpUser ?? '',
    hasPassword: Boolean(org?.smtpPassEncrypted),
    smtpFrom: org?.smtpFrom ?? '',
    smtpReplyTo: org?.smtpReplyTo ?? '',
    smtpEnabled: org?.smtpEnabled ?? false,
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

/**
 * PUT — SMTP config güncelle.
 * - smtpPassword boş/undefined gelirse mevcut şifre korunur.
 * - smtpEnabled=true ancak kritik alanlar (host/user/pass) eksikse 400 döner.
 */
export async function PUT(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const parsed = smtpSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const data = parsed.data

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { smtpPassEncrypted: true, smtpHost: true, smtpUser: true, smtpEnabled: true },
  })

  // smtpEnabled=true isteniyorsa temel alanların bulunması şart
  const willBeEnabled = data.smtpEnabled ?? existing?.smtpEnabled ?? false
  const effectiveHost = data.smtpHost ?? existing?.smtpHost
  const effectiveUser = data.smtpUser ?? existing?.smtpUser
  const hasPassword = data.smtpPassword ? true : Boolean(existing?.smtpPassEncrypted)

  if (willBeEnabled && (!effectiveHost || !effectiveUser || !hasPassword)) {
    return errorResponse('SMTP aktifleştirmek için host, kullanıcı adı ve şifre zorunludur.', 400)
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.smtpHost !== undefined && { smtpHost: data.smtpHost || null }),
        ...(data.smtpPort !== undefined && { smtpPort: data.smtpPort ?? 587 }),
        ...(data.smtpSecure !== undefined && { smtpSecure: data.smtpSecure }),
        ...(data.smtpUser !== undefined && { smtpUser: data.smtpUser || null }),
        ...(data.smtpPassword && { smtpPassEncrypted: encrypt(data.smtpPassword) }),
        ...(data.smtpFrom !== undefined && { smtpFrom: data.smtpFrom || null }),
        ...(data.smtpReplyTo !== undefined && { smtpReplyTo: data.smtpReplyTo || null }),
        ...(data.smtpEnabled !== undefined && { smtpEnabled: data.smtpEnabled }),
      },
      select: {
        smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true,
        smtpPassEncrypted: true, smtpFrom: true, smtpReplyTo: true, smtpEnabled: true,
      },
    })

    // Transporter cache'ini geçersiz kıl — yeni config hemen devreye girsin
    invalidateOrgTransporter(orgId)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'smtp.update',
      entityType: 'organization',
      entityId: orgId,
      newData: {
        enabled: updated.smtpEnabled,
        host: updated.smtpHost,
        port: updated.smtpPort,
        user: updated.smtpUser,
        passwordChanged: Boolean(data.smtpPassword),
      },
      request,
    })

    return jsonResponse({
      smtpHost: updated.smtpHost ?? '',
      smtpPort: updated.smtpPort ?? 587,
      smtpSecure: updated.smtpSecure,
      smtpUser: updated.smtpUser ?? '',
      hasPassword: Boolean(updated.smtpPassEncrypted),
      smtpFrom: updated.smtpFrom ?? '',
      smtpReplyTo: updated.smtpReplyTo ?? '',
      smtpEnabled: updated.smtpEnabled,
    })
  } catch (err) {
    logger.error('SmtpSettings', 'SMTP ayarları güncellenemedi', err)
    return errorResponse('SMTP ayarları kaydedilemedi', 500)
  }
}
