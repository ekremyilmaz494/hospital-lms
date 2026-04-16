import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createSmgPeriodSchema } from '@/lib/validations'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const periods = await prisma.smgPeriod.findMany({
    where: { organizationId: dbUser!.organizationId! },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse({ periods }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgPeriodSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const orgId = dbUser!.organizationId!
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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'CREATE',
    entityType: 'SmgPeriod',
    entityId: period.id,
    newData: period,
    request,
  })

  return jsonResponse(period, 201)
}
