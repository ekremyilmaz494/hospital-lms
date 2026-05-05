import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'

const bodySchema = z.object({
  newOwnerUserId: z.string().uuid('Geçersiz user kimliği'),
}).strict()

/**
 * POST /api/super-admin/hospitals/:id/transfer-ownership
 *
 * Esas Yönetici devri — yalnız super_admin yetkisindedir.
 * - newOwnerUserId bu org'a ait, role='admin', aktif user olmak zorunda
 * - Tek transaction'da Organization.ownerUserId güncellenir
 * - Audit log: kim, kimden, kime, ne zaman
 */
export const POST = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id: organizationId } = params

  const body = await parseBody(request)
  if (!body) throw new ApiError('Geçersiz istek verisi', 400)

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }
  const { newOwnerUserId } = parsed.data

  const [org, newOwner] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, ownerUserId: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: newOwnerUserId },
      select: { id: true, organizationId: true, role: true, isActive: true, email: true },
    }),
  ])

  if (!org) return errorResponse('Organizasyon bulunamadı', 404)
  if (!newOwner) return errorResponse('Hedef kullanıcı bulunamadı', 404)
  if (newOwner.organizationId !== organizationId) {
    return errorResponse('Hedef kullanıcı bu organizasyona ait değil', 400)
  }
  if (newOwner.role !== 'admin') {
    return errorResponse('Esas Yönetici yalnızca admin rolündeki user için atanabilir', 400)
  }
  if (!newOwner.isActive) {
    return errorResponse('Pasif kullanıcı Esas Yönetici olamaz', 400)
  }
  if (org.ownerUserId === newOwnerUserId) {
    return errorResponse('Bu kullanıcı zaten Esas Yönetici', 409)
  }

  const previousOwnerUserId = org.ownerUserId

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { ownerUserId: newOwnerUserId },
    })
  } catch (err) {
    logger.error('SuperAdmin TransferOwnership', 'Update başarısız', {
      organizationId,
      newOwnerUserId,
      error: (err as Error).message,
    })
    return errorResponse('Esas Yönetici devri başarısız oldu', 500)
  }

  await audit({
    action: 'org.ownership_transfer',
    entityType: 'organization',
    entityId: organizationId,
    oldData: { ownerUserId: previousOwnerUserId },
    newData: { ownerUserId: newOwnerUserId, newOwnerEmail: newOwner.email },
  })

  return jsonResponse({
    organizationId,
    previousOwnerUserId,
    newOwnerUserId,
  })
})
