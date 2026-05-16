/**
 * GET    /api/admin/training-periods/[id] — detay + atama sayısı
 * PUT    /api/admin/training-periods/[id] — sadece status='upcoming' iken label/tarih güncelle
 * DELETE /api/admin/training-periods/[id] — sadece upcoming + atama yok ise sil
 */

import { z } from 'zod'
import { withAdminRoute } from '@/lib/api-handler'
import { jsonResponse, ApiError, parseBody } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getPeriodById } from '@/lib/training-periods'

const periodUpdateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isDefault: z.boolean().optional(),
})

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const period = await getPeriodById(params.id, organizationId)

  const assignmentCount = await prisma.trainingAssignment.count({
    where: { periodId: period.id },
  })

  return jsonResponse(
    {
      ...period,
      assignmentCount,
    },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
}, { requireOrganization: true })

export const PUT = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const raw = await parseBody<unknown>(request)
  if (!raw) throw new ApiError('Geçersiz istek gövdesi', 400)

  const parsed = periodUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(parsed.error.issues[0]?.message ?? 'Doğrulama hatası', 400)
  }

  const period = await getPeriodById(params.id, organizationId)

  if (period.status !== 'upcoming') {
    throw new ApiError('Aktif veya kapalı dönem güncellenemez', 409)
  }

  const data: {
    label?: string
    startDate?: Date
    endDate?: Date
    isDefault?: boolean
  } = {}
  if (parsed.data.label !== undefined) data.label = parsed.data.label
  if (parsed.data.startDate !== undefined) data.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate !== undefined) data.endDate = new Date(parsed.data.endDate)
  if (parsed.data.isDefault !== undefined) data.isDefault = parsed.data.isDefault

  const finalStart = data.startDate ?? period.startDate
  const finalEnd = data.endDate ?? period.endDate
  if (finalEnd <= finalStart) {
    throw new ApiError('Dönem bitiş tarihi başlangıçtan sonra olmalı', 400)
  }

  const updated = await prisma.trainingPeriod.update({
    where: { id: period.id },
    data,
  })

  await audit({
    action: 'training_period.update',
    entityType: 'training_period',
    entityId: updated.id,
    oldData: {
      label: period.label,
      startDate: period.startDate,
      endDate: period.endDate,
      isDefault: period.isDefault,
    },
    newData: {
      label: updated.label,
      startDate: updated.startDate,
      endDate: updated.endDate,
      isDefault: updated.isDefault,
    },
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const period = await getPeriodById(params.id, organizationId)

  if (period.status !== 'upcoming') {
    throw new ApiError('Sadece yaklaşan dönemler silinebilir', 409)
  }

  // Bağımsız sayım sorgularını paralel çalıştır
  const [assignmentCount, certificateCount] = await Promise.all([
    prisma.trainingAssignment.count({ where: { periodId: period.id } }),
    prisma.certificate.count({ where: { periodId: period.id } }),
  ])

  if (assignmentCount > 0 || certificateCount > 0) {
    throw new ApiError('Atanmış eğitim varken silinemez', 409)
  }

  await prisma.trainingPeriod.delete({ where: { id: period.id } })

  await audit({
    action: 'training_period.delete',
    entityType: 'training_period',
    entityId: period.id,
    oldData: {
      year: period.year,
      label: period.label,
      status: period.status,
    },
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
