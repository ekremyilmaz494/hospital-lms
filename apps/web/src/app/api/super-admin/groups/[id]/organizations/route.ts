import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { groupAttachOrgSchema } from '@/lib/validations'
import type { z } from 'zod/v4'

/**
 * POST /api/super-admin/groups/[id]/organizations
 * Bir hastaneyi (Organization) gruba bağlar. maxOrganizations (sözleşmeli hastane sayısı)
 * tavanı aşılırsa 409 döner. Başka bir gruba bağlı hastane önce çözülmelidir.
 */
export const POST = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const body = await parseBody<z.infer<typeof groupAttachOrgSchema>>(request)
  const parsed = groupAttachOrgSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)

  const group = await prisma.organizationGroup.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, maxOrganizations: true, _count: { select: { organizations: true } } },
  })
  if (!group) return errorResponse('Grup bulunamadı', 404)

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true, name: true, groupId: true, isDemo: true },
  })
  if (!org) return errorResponse('Hastane bulunamadı', 404)
  if (org.isDemo) return errorResponse('Demo hastaneler gruba bağlanamaz', 400)

  if (org.groupId === group.id) {
    return jsonResponse({ ok: true, alreadyAttached: true })
  }
  if (org.groupId) {
    return errorResponse('Bu hastane başka bir gruba bağlı. Önce mevcut grubundan çıkarın.', 409)
  }

  // Sözleşmeli hastane sayısı tavanı (maxOrganizations) — null = sınırsız.
  if (group.maxOrganizations != null && group._count.organizations >= group.maxOrganizations) {
    return errorResponse(
      `Grup hastane limiti dolu (${group.maxOrganizations}). Yeni hastane bağlamak için limiti artırın.`,
      409,
    )
  }

  await prisma.organization.update({ where: { id: org.id }, data: { groupId: group.id } })

  await audit({
    action: 'group.attach_organization',
    entityType: 'organization_group',
    entityId: group.id,
    newData: { organizationId: org.id, organizationName: org.name },
  })

  return jsonResponse({ ok: true })
})

/**
 * DELETE /api/super-admin/groups/[id]/organizations
 * Bir hastaneyi gruptan çıkarır (groupId=null). Hastane bağımsız (standalone) olarak çalışmaya
 * devam eder — verisi/erişimi etkilenmez.
 */
export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const body = await parseBody<z.infer<typeof groupAttachOrgSchema>>(request)
  const parsed = groupAttachOrgSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)

  const org = await prisma.organization.findFirst({
    where: { id: parsed.data.organizationId, groupId: params.id },
    select: { id: true, name: true },
  })
  if (!org) return errorResponse('Hastane bu gruba bağlı değil', 404)

  await prisma.organization.update({ where: { id: org.id }, data: { groupId: null } })

  await audit({
    action: 'group.detach_organization',
    entityType: 'organization_group',
    entityId: params.id,
    oldData: { organizationId: org.id, organizationName: org.name },
  })

  return jsonResponse({ ok: true })
})
