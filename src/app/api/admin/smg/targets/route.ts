import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createSmgTargetSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const periodId = searchParams.get('periodId')
  if (!periodId) return errorResponse('periodId parametresi zorunludur', 400)

  const period = await prisma.smgPeriod.findFirst({
    where: { id: periodId, organizationId: dbUser!.organizationId! },
    select: { id: true },
  })
  if (!period) return errorResponse('Dönem bulunamadı', 404)

  const targets = await prisma.smgTarget.findMany({
    where: { periodId, organizationId: dbUser!.organizationId! },
    select: {
      id: true,
      unvan: true,
      userId: true,
      requiredPoints: true,
      createdAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, title: true },
      },
    },
    orderBy: [{ unvan: 'asc' }, { createdAt: 'asc' }],
  })

  return jsonResponse(
    { targets },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' }
  )
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgTargetSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  // Dönem + kullanıcı doğrulaması paralel
  const [period, userCheck] = await Promise.all([
    prisma.smgPeriod.findFirst({
      where: { id: parsed.data.periodId, organizationId: dbUser!.organizationId! },
      select: { id: true },
    }),
    parsed.data.userId
      ? prisma.user.findFirst({
          where: { id: parsed.data.userId, organizationId: dbUser!.organizationId! },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  if (!period) return errorResponse('Dönem bulunamadı', 404)
  if (parsed.data.userId && !userCheck) return errorResponse('Kullanıcı bulunamadı', 404)

  // Unique kontrol
  const existing = await prisma.smgTarget.findFirst({
    where: {
      periodId: parsed.data.periodId,
      unvan: parsed.data.unvan ?? null,
      userId: parsed.data.userId ?? null,
    },
    select: { id: true },
  })
  if (existing) return errorResponse('Bu hedef zaten mevcut', 409)

  const target = await prisma.smgTarget.create({
    data: {
      organizationId: dbUser!.organizationId!,
      periodId: parsed.data.periodId,
      unvan: parsed.data.unvan ?? null,
      userId: parsed.data.userId ?? null,
      requiredPoints: parsed.data.requiredPoints,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'CREATE',
    entityType: 'SmgTarget',
    entityId: target.id,
    newData: target,
    request,
  })

  return jsonResponse(target, 201)
}
