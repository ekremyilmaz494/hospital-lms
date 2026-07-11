import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, invalidateAuthCache } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { updateGroupSchema } from '@/lib/validations'
import { clearAuthUserGroupClaims } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import type { z } from 'zod/v4'

/**
 * GET /api/super-admin/groups/[id]
 * Grup detayı: sahip, bağlı hastaneler (kısa) ve sayımlar.
 */
export const GET = withSuperAdminRoute<{ id: string }>(async ({ params }) => {
  const group = await prisma.organizationGroup.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      code: true,
      maxOrganizations: true,
      logoUrl: true,
      brandColor: true,
      isActive: true,
      createdAt: true,
      ownerUser: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
      organizations: {
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true,
          isSuspended: true,
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { organizations: true } },
    },
  })

  if (!group) return errorResponse('Grup bulunamadı', 404)
  return jsonResponse(group, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
})

/**
 * PATCH /api/super-admin/groups/[id]
 * Grup ayarlarını günceller (ad, maxOrganizations, marka, aktif/pasif).
 */
export const PATCH = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const body = await parseBody<z.infer<typeof updateGroupSchema>>(request)
  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  }
  const data = parsed.data

  const existing = await prisma.organizationGroup.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existing) return errorResponse('Grup bulunamadı', 404)

  const updated = await prisma.organizationGroup.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.maxOrganizations !== undefined && { maxOrganizations: data.maxOrganizations }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
      ...(data.brandColor !== undefined && { brandColor: data.brandColor }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: { id: true, name: true, code: true, maxOrganizations: true, logoUrl: true, brandColor: true, isActive: true },
  })

  await audit({
    action: 'update',
    entityType: 'organization_group',
    entityId: params.id,
    newData: data,
  })

  return jsonResponse(updated)
})

/**
 * DELETE /api/super-admin/groups/[id]
 * Grubu hard-delete eder. Yalnız bağlı hastanesi OLMAYAN grup silinebilir (önce hastaneleri
 * çöz). Grup yöneticisinin (esas yönetici) claim'leri temizlenir ve hesabı pasifleştirilir
 * (org'suz + grup'suz "yetim admin" kırık durumunu önlemek için).
 */
export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, audit }) => {
  const group = await prisma.organizationGroup.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerUserId: true, _count: { select: { organizations: true } } },
  })
  if (!group) return errorResponse('Grup bulunamadı', 404)

  if (group._count.organizations > 0) {
    return errorResponse('Bu grupta hâlâ bağlı hastane var. Önce hastaneleri gruptan çıkarın.', 409)
  }

  // Sahip hesabını nötrleştir: grup claim'lerini temizle + pasifleştir (JWT cache'i geçersiz kıl).
  if (group.ownerUserId) {
    try {
      await clearAuthUserGroupClaims(group.ownerUserId)
    } catch (err) {
      logger.warn('group-delete', 'Grup yöneticisi claim temizleme başarısız (devam ediliyor)', err instanceof Error ? err.message : err)
    }
    await prisma.user.update({ where: { id: group.ownerUserId }, data: { isActive: false } }).catch(() => {})
    invalidateAuthCache(group.ownerUserId)
  }

  // group_id FK'leri ON DELETE SET NULL — owner.groupId otomatik null'lanır.
  await prisma.organizationGroup.delete({ where: { id: params.id } })

  await audit({
    action: 'delete',
    entityType: 'organization_group',
    entityId: params.id,
    oldData: { groupName: group.name, ownerUserId: group.ownerUserId },
  })

  return jsonResponse({ ok: true })
})
