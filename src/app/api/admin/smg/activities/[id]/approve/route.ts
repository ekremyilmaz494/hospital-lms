import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { approveSmgActivitySchema } from '@/lib/validations'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = approveSmgActivitySchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
  })

  if (!activity) return errorResponse('Aktivite bulunamadı', 404)

  const updated = await prisma.smgActivity.update({
    where: { id },
    data: {
      approvalStatus: parsed.data.status,
      approvedBy: dbUser!.id,
      approvedAt: new Date(),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: parsed.data.status === 'APPROVED' ? 'APPROVE' : 'REJECT',
    entityType: 'SmgActivity',
    entityId: id,
    oldData: { approvalStatus: activity.approvalStatus },
    newData: { approvalStatus: parsed.data.status },
    request,
  })

  return jsonResponse(updated)
}
