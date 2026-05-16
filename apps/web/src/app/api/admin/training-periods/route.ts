/**
 * GET  /api/admin/training-periods — org'un tüm dönemlerini listeler (year desc)
 * POST /api/admin/training-periods — yeni dönem oluşturur (idempotent on year)
 *
 * `withAdminRoute` + `requireOrganization: true` — super_admin null org ile gelirse 400.
 */

import { z } from 'zod'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, ApiError, parseBody } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { openNewPeriod, activatePeriod } from '@/lib/training-periods'

const periodCreateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  label: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isDefault: z.boolean().optional(),
  activate: z.boolean().optional(),
})

export const GET = withAdminRoute(async ({ organizationId }) => {
  const periods = await prisma.trainingPeriod.findMany({
    where: { organizationId },
    select: {
      id: true,
      year: true,
      label: true,
      status: true,
      startDate: true,
      endDate: true,
      isDefault: true,
      closedAt: true,
    },
    orderBy: { year: 'desc' },
  })
  return jsonResponse(periods, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, dbUser, audit }) => {
  const raw = await parseBody<unknown>(request)
  if (!raw) throw new ApiError('Geçersiz istek gövdesi', 400)

  const parsed = periodCreateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }

  const { year, label, startDate, endDate, isDefault, activate } = parsed.data

  const created = await openNewPeriod(
    organizationId,
    {
      year,
      label,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isDefault,
    },
    { activate },
  )

  // openNewPeriod idempotent — eğer aynı (org, year) varsa onu döner.
  // activate=true ise eskiyi kapatıp bunu aktif yap (servis idempotent).
  let final = created
  if (activate && created.status !== 'active') {
    final = await activatePeriod(created.id, organizationId, dbUser.id)
  }

  await audit({
    action: 'training_period.create',
    entityType: 'training_period',
    entityId: final.id,
    newData: {
      year: final.year,
      label: final.label,
      status: final.status,
      isDefault: final.isDefault,
    },
  })

  return jsonResponse(final, 201)
}, { requireOrganization: true })
