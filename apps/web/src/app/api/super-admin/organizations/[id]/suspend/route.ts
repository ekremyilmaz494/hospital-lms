import { prisma } from '@/lib/prisma'
import { jsonResponse, parseBody, invalidateOrgAuthCache } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

export const POST = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id } = params

  const body = await parseBody<{ reason?: string }>(request)

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: true,
      suspendedReason: body?.reason ?? null,
      suspendedAt: new Date(),
    },
  })

  await audit({
    action: 'suspend',
    entityType: 'organization',
    entityId: id,
    newData: { reason: body?.reason },
  })

  // L21: askıya alma sonrası org kullanıcılarının auth cache'ini geçersiz kıl — aksi halde
  // org üyeleri 30s'e kadar erişmeye devam edebilirdi (orgOk bayat kalır).
  invalidateOrgAuthCache(id)

  return jsonResponse(organization)
})

export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, audit }) => {
  const { id } = params

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      isSuspended: false,
      suspendedReason: null,
      suspendedAt: null,
    },
  })

  await audit({
    action: 'unsuspend',
    entityType: 'organization',
    entityId: id,
  })

  // L21: askıdan kaldırma sonrası cache'i temizle — org üyeleri erişimi hemen geri kazanır.
  invalidateOrgAuthCache(id)

  return jsonResponse(organization)
})
