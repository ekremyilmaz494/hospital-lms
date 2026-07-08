import { prisma } from '@/lib/prisma'
import { jsonResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

/**
 * Lisans iptali — organizasyon suspend deseninin lisans karşılığı.
 * POST = iptal et: bir SONRAKİ heartbeat'te on-prem kurulum `revoked` makbuzu
 * alır ve kilitlenir (anında değil — heartbeat periyodu ~6 saat).
 * DELETE = iptali kaldır (geri dönüşlü).
 */

export const POST = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const body = await parseBody<{ reason?: string }>(request)

  const existing = await prisma.license.findUnique({
    where: { id: params.id },
    select: { status: true, customerName: true },
  })
  if (!existing) throw new ApiError('Lisans bulunamadı', 404)

  const license = await prisma.license.update({
    where: { id: params.id },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
      revokeReason: body?.reason ?? null,
    },
  })

  await audit({
    action: 'license.revoke',
    entityType: 'license',
    entityId: params.id,
    oldData: { status: existing.status },
    newData: { reason: body?.reason ?? null },
  })

  return jsonResponse(license)
})

export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, audit }) => {
  const existing = await prisma.license.findUnique({
    where: { id: params.id },
    select: { status: true },
  })
  if (!existing) throw new ApiError('Lisans bulunamadı', 404)

  const license = await prisma.license.update({
    where: { id: params.id },
    data: { status: 'active', revokedAt: null, revokeReason: null },
  })

  await audit({
    action: 'license.unrevoke',
    entityType: 'license',
    entityId: params.id,
    oldData: { status: existing.status },
  })

  return jsonResponse(license)
})
