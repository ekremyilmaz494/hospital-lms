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

  return jsonResponse({ periods })
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

  const period = await prisma.smgPeriod.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      organizationId: dbUser!.organizationId!,
    },
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
