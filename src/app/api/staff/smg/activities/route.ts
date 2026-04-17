import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
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

  // Kategori artık zorunlu (SKS denetimi için). Kategoriyi doğrula, maksimum puan kuralını uygula.
  const category = await prisma.smgCategory.findFirst({
    where: {
      id: parsed.data.categoryId,
      organizationId: dbUser!.organizationId!,
      isActive: true,
    },
    select: { id: true, code: true, maxPointsPerActivity: true },
  })
  if (!category) return errorResponse('Kategori bulunamadı veya aktif değil', 404)

  if (category.maxPointsPerActivity && parsed.data.smgPoints > category.maxPointsPerActivity) {
    return errorResponse(
      `Bu kategori için maksimum ${category.maxPointsPerActivity} puan girilebilir`,
      400
    )
  }

  const activity = await prisma.smgActivity.create({
    data: {
      title: parsed.data.title,
      provider: parsed.data.provider,
      smgPoints: parsed.data.smgPoints,
      certificateUrl: parsed.data.certificateUrl,
      activityType: category.code,
      categoryId: category.id,
      completionDate: new Date(parsed.data.completionDate),
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      approvalStatus: 'PENDING',
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'CREATE',
    entityType: 'SmgActivity',
    entityId: activity.id,
    newData: {
      title: activity.title,
      activityType: activity.activityType,
      categoryId: activity.categoryId,
      smgPoints: activity.smgPoints,
      completionDate: activity.completionDate,
    },
    request,
  })

  return jsonResponse(activity, 201)
}
