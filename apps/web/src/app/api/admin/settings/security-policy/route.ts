import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { isValidIpEntry } from '@/lib/auth/ip-allowlist'
import { z } from 'zod/v4'

const schema = z.object({
  dataRetentionDays: z.coerce.number().int().min(30).max(3650).optional(),
  notificationRetentionDays: z.coerce.number().int().min(7).max(3650).optional(),
  backupRetentionDays: z.coerce.number().int().min(7).max(3650).optional(),
  ipAllowlistEnabled: z.boolean().optional(),
  ipAllowlist: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
})

const SELECT = {
  dataRetentionDays: true,
  notificationRetentionDays: true,
  backupRetentionDays: true,
  ipAllowlistEnabled: true,
  ipAllowlist: true,
} as const

function shape(org: {
  dataRetentionDays: number
  notificationRetentionDays: number
  backupRetentionDays: number
  ipAllowlistEnabled: boolean
  ipAllowlist: unknown
} | null) {
  return {
    dataRetentionDays: org?.dataRetentionDays ?? 365,
    notificationRetentionDays: org?.notificationRetentionDays ?? 90,
    backupRetentionDays: org?.backupRetentionDays ?? 90,
    ipAllowlistEnabled: org?.ipAllowlistEnabled ?? false,
    ipAllowlist: Array.isArray(org?.ipAllowlist) ? (org.ipAllowlist as string[]) : [],
  }
}

// GET /api/admin/settings/security-policy — veri saklama + IP allowlist ayarlarını getir
export const GET = withAdminRoute(async ({ organizationId }) => {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: SELECT })
  return jsonResponse(shape(org), 200, { 'Cache-Control': 'private, no-store' })
}, { requireOrganization: true, strict: true })

// PUT /api/admin/settings/security-policy — günceller (validasyon + audit)
export const PUT = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek verisi', 400)

  const parsed = schema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)
  const d = parsed.data

  // IP allowlist girdilerini doğrula — geçersiz CIDR/IP kaydedilmesin (kilitlenme riski).
  if (d.ipAllowlist) {
    for (const entry of d.ipAllowlist) {
      if (!isValidIpEntry(entry)) return errorResponse(`Geçersiz IP/CIDR girdisi: ${entry}`, 400)
    }
  }

  const old = await prisma.organization.findUnique({ where: { id: organizationId }, select: SELECT })

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(d.dataRetentionDays !== undefined && { dataRetentionDays: d.dataRetentionDays }),
      ...(d.notificationRetentionDays !== undefined && { notificationRetentionDays: d.notificationRetentionDays }),
      ...(d.backupRetentionDays !== undefined && { backupRetentionDays: d.backupRetentionDays }),
      ...(d.ipAllowlistEnabled !== undefined && { ipAllowlistEnabled: d.ipAllowlistEnabled }),
      ...(d.ipAllowlist !== undefined && { ipAllowlist: d.ipAllowlist }),
    },
    select: SELECT,
  })

  await audit({
    action: 'settings.security_policy.update',
    entityType: 'organization',
    entityId: organizationId,
    oldData: shape(old),
    newData: shape(updated),
  })

  return jsonResponse(shape(updated))
}, { requireOrganization: true, strict: true })
