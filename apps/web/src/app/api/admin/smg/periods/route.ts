import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createSmgPeriodSchema } from '@/lib/validations'

export const GET = withAdminRoute(async ({ organizationId }) => {
  const periods = await prisma.smgPeriod.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse({ periods }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgPeriodSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const orgId = organizationId
  const newStart = new Date(parsed.data.startDate)
  const newEnd = new Date(parsed.data.endDate)

  // Tarih çakışma kontrolü — aynı organizasyonda başka bir dönemin tarih aralığı
  // ile kesişen yeni dönem oluşturulamaz (aktivitelerin çift sayılmaması için).
  const overlapping = await prisma.smgPeriod.findFirst({
    where: {
      organizationId: orgId,
      AND: [
        { startDate: { lte: newEnd } },
        { endDate: { gte: newStart } },
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

  // Atomik: isActive=true ise mevcut aktif dönemleri pasife al, sonra insert.
  const period = await prisma.$transaction(async (tx) => {
    if (parsed.data.isActive !== false) {
      await tx.smgPeriod.updateMany({
        where: { organizationId: orgId, isActive: true },
        data: { isActive: false },
      })
    }
    return tx.smgPeriod.create({
      data: {
        ...parsed.data,
        startDate: newStart,
        endDate: newEnd,
        organizationId: orgId,
      },
    })
  })

  await audit({
    action: 'CREATE',
    entityType: 'SmgPeriod',
    entityId: period.id,
    newData: period,
  })

  return jsonResponse(period, 201)
}, { requireOrganization: true })
