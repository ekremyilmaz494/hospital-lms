import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { updateSmgPeriodSchema } from '@/lib/validations'

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateSmgPeriodSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const period = await prisma.smgPeriod.findFirst({
    where: { id, organizationId },
  })

  if (!period) return errorResponse('Dönem bulunamadı', 404)

  const orgId = organizationId
  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate !== undefined) updateData.endDate = new Date(parsed.data.endDate)
  if (parsed.data.requiredPoints !== undefined) updateData.requiredPoints = parsed.data.requiredPoints
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive

  // Tarih veya aktif durum değiştiriliyorsa ek kontroller:
  const effectiveStart = parsed.data.startDate ? new Date(parsed.data.startDate) : period.startDate
  const effectiveEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : period.endDate

  // startDate tek başına verildiyse mevcut endDate ile, veya tersi — tutarlılığı route'da kontrol et.
  if (effectiveEnd <= effectiveStart) {
    return errorResponse('Bitiş tarihi başlangıç tarihinden sonra olmalıdır', 400)
  }

  // Çakışma kontrolü: aynı organizasyonda başka bir dönemle (kendisi hariç) kesişme olmamalı.
  // Ardından gelen transaction bu sonuca bağımlı — paralelleştirilemez.
  if (parsed.data.startDate !== undefined || parsed.data.endDate !== undefined) {
    const overlapping = await prisma.smgPeriod.findFirst({ // perf-check-disable-line
      where: {
        organizationId: orgId,
        NOT: { id },
        AND: [
          { startDate: { lte: effectiveEnd } },
          { endDate: { gte: effectiveStart } },
        ],
      },
      select: { id: true, name: true },
    })
    if (overlapping) {
      return errorResponse(
        `"${overlapping.name}" dönemi ile tarihler çakışıyor. Lütfen çakışmayan bir aralık seçin.`,
        409
      )
    }
  }

  // isActive=true yapılıyorsa diğer aktif dönemleri pasife al (atomik).
  const updated = await prisma.$transaction(async (tx) => { // perf-check-disable-line
    if (parsed.data.isActive === true) {
      await tx.smgPeriod.updateMany({
        where: { organizationId: orgId, isActive: true, NOT: { id } },
        data: { isActive: false },
      })
    }
    return tx.smgPeriod.update({
      where: { id },
      data: updateData,
    })
  })

  await audit({
    action: 'UPDATE',
    entityType: 'SmgPeriod',
    entityId: id,
    oldData: period,
    newData: updated,
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  const { id } = params

  const period = await prisma.smgPeriod.findFirst({
    where: { id, organizationId },
  })

  if (!period) return errorResponse('Dönem bulunamadı', 404)

  // Check if any activities are linked to this period's date range
  const linkedActivities = await prisma.smgActivity.count({
    where: {
      organizationId,
      completionDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
    },
  })

  if (linkedActivities > 0) {
    return errorResponse(
      `Bu döneme bağlı ${linkedActivities} SMG aktivitesi bulunmaktadır. ` +
        `Dönemi silmek yerine arşivlemek için aktif bayrağını kapatabilirsiniz; ` +
        `silmekte ısrarcıysanız önce bu aktiviteleri tek tek kaldırmanız gerekir.`,
      409
    )
  }

  const deleted = await prisma.smgPeriod.deleteMany({ where: { id, organizationId } })
  if (deleted.count === 0) return errorResponse('Donem bulunamadi veya yetkiniz yok', 404)

  await audit({
    action: 'DELETE',
    entityType: 'SmgPeriod',
    entityId: id,
    oldData: period,
  })

  return jsonResponse({ success: true })
}, { requireOrganization: true })
