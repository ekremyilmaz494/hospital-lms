import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { BRAND } from '@/lib/brand'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

/**
 * Tenant başına e-posta tercihleri — merkezi SES kullanıldığı için sadece
 * görünen ad + reply-to + opt-out toggle. Host/şifre yok.
 */
const emailSchema = z.object({
  emailDisplayName: z.string().trim().max(100, 'Görünen ad en fazla 100 karakter olabilir').optional().nullable(),
  emailReplyTo: z
    .string()
    .trim()
    .max(320, 'E-posta adresi en fazla 320 karakter olabilir')
    .email('Geçerli bir e-posta adresi girin')
    .or(z.literal(''))
    .optional()
    .nullable(),
  emailEnabled: z.boolean().optional(),
})

/** GET — mevcut email ayarları + platform brand info (UI'da gösterilir). */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      emailDisplayName: true,
      emailReplyTo: true,
      emailEnabled: true,
    },
  })

  return jsonResponse(
    {
      emailDisplayName: org?.emailDisplayName ?? '',
      emailReplyTo: org?.emailReplyTo ?? '',
      emailEnabled: org?.emailEnabled ?? true,
      brand: {
        name: BRAND.name,
        fullName: BRAND.fullName,
        fromAddress: BRAND.fromAddress,
        domain: BRAND.domain,
      },
      effectiveDisplayName: org?.emailDisplayName?.trim() || org?.name || BRAND.fullName,
    },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  )
}, { requireOrganization: true, strict: true })

/**
 * PUT — email tercihlerini günceller. Audit log düşer.
 * Boş string verilirse alan NULL'a düşer (varsayılana dön).
 */
export const PUT = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const parsed = emailSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const data = parsed.data

  try {
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(data.emailDisplayName !== undefined && {
          emailDisplayName: data.emailDisplayName?.trim() ? data.emailDisplayName.trim() : null,
        }),
        ...(data.emailReplyTo !== undefined && {
          emailReplyTo: data.emailReplyTo?.trim() ? data.emailReplyTo.trim() : null,
        }),
        ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      },
      select: { emailDisplayName: true, emailReplyTo: true, emailEnabled: true },
    })

    await audit({
      action: 'email.update',
      entityType: 'organization',
      entityId: organizationId,
      newData: updated,
    })

    return jsonResponse({
      emailDisplayName: updated.emailDisplayName ?? '',
      emailReplyTo: updated.emailReplyTo ?? '',
      emailEnabled: updated.emailEnabled,
    })
  } catch (err) {
    logger.error('EmailSettings', 'E-posta ayarları güncellenemedi', err)
    return errorResponse('E-posta ayarları kaydedilemedi', 500)
  }
}, { requireOrganization: true, strict: true })
