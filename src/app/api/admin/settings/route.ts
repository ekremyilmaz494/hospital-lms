import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { z } from 'zod/v4'

const settingsSchema = z.object({
  hospitalName: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  sessionTimeout: z.number().int().min(5).max(480).optional(),
  defaultPassingScore: z.coerce.number().int().min(0).max(100).optional(),
  defaultMaxAttempts: z.coerce.number().int().min(1).max(10).optional(),
  defaultExamDuration: z.coerce.number().int().min(5).max(180).optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçerli bir hex renk kodu girin').optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Geçerli bir hex renk kodu girin').optional(),
  loginBannerUrl: z.string().url().optional().or(z.literal('')),
})

// GET /api/admin/settings — Hastane ayarlarını getir
export const GET = withAdminRoute(async ({ organizationId }) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, logoUrl: true, email: true, phone: true, address: true, sessionTimeout: true, defaultPassingScore: true, defaultMaxAttempts: true, defaultExamDuration: true, brandColor: true, secondaryColor: true, loginBannerUrl: true, customDomain: true },
  })

  return jsonResponse({
    defaultPassingScore: org?.defaultPassingScore ?? 70,
    defaultMaxAttempts: org?.defaultMaxAttempts ?? 3,
    defaultExamDuration: org?.defaultExamDuration ?? 30,
    hospitalName: org?.name ?? '',
    logoUrl: org?.logoUrl ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    address: org?.address ?? '',
    sessionTimeout: org?.sessionTimeout ?? 30,
    brandColor: org?.brandColor ?? '#0F172A',
    secondaryColor: org?.secondaryColor ?? '#3B82F6',
    loginBannerUrl: org?.loginBannerUrl ?? '',
    customDomain: org?.customDomain ?? '',
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true, strict: true })

// PUT /api/admin/settings — Hastane ayarlarını güncelle
export const PUT = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { hospitalName, logoUrl, email, phone, address, sessionTimeout, defaultPassingScore, defaultMaxAttempts, defaultExamDuration, brandColor, secondaryColor, loginBannerUrl } = parsed.data

  const oldOrg = await prisma.organization.findUnique({ where: { id: organizationId } })

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(hospitalName !== undefined && { name: hospitalName }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(sessionTimeout !== undefined && { sessionTimeout: Math.min(Math.max(Number(sessionTimeout), 5), 480) }),
      ...(defaultPassingScore !== undefined && { defaultPassingScore }),
      ...(defaultMaxAttempts !== undefined && { defaultMaxAttempts }),
      ...(defaultExamDuration !== undefined && { defaultExamDuration }),
      ...(brandColor !== undefined && { brandColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(loginBannerUrl !== undefined && { loginBannerUrl: loginBannerUrl || null }),
    },
  })

  await audit({
    action: 'settings.update',
    entityType: 'organization',
    entityId: organizationId,
    oldData: { name: oldOrg?.name, email: oldOrg?.email, phone: oldOrg?.phone },
    newData: { name: updated.name, email: updated.email, phone: updated.phone },
  })

  return jsonResponse({
    hospitalName: updated.name,
    logoUrl: updated.logoUrl ?? '',
    email: updated.email ?? '',
    phone: updated.phone ?? '',
    address: updated.address ?? '',
    sessionTimeout: updated.sessionTimeout,
    defaultPassingScore: updated.defaultPassingScore ?? 70,
    defaultMaxAttempts: updated.defaultMaxAttempts ?? 3,
    defaultExamDuration: updated.defaultExamDuration ?? 30,
    brandColor: updated.brandColor,
    secondaryColor: updated.secondaryColor,
    loginBannerUrl: updated.loginBannerUrl ?? '',
    customDomain: updated.customDomain ?? '',
  })
}, { requireOrganization: true, strict: true })
