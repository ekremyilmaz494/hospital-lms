import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { createSmgActivitySchema } from '@/lib/validations'

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createSmgActivitySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const activity = await prisma.smgActivity.create({
    data: {
      ...parsed.data,
      completionDate: new Date(parsed.data.completionDate),
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      approvalStatus: 'PENDING',
    },
  })

  return jsonResponse(activity, 201)
}
