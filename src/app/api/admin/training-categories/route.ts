import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createTrainingCategorySchema } from '@/lib/validations'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'

/** Türkçe karakterleri normalize edip URL-safe slug üretir */
function toSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  let categories = await prisma.trainingCategory.findMany({
    where: { organizationId: dbUser!.organizationId! },
    orderBy: { order: 'asc' },
    select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
  })

  // DB'de kayıt yoksa varsayılanları DB'ye seed'le (tek seferlik)
  if (categories.length === 0) {
    await prisma.trainingCategory.createMany({
      data: TRAINING_CATEGORIES.map((cat, i) => ({
        organizationId: dbUser!.organizationId!,
        value: cat.value,
        label: cat.label,
        icon: cat.icon,
        order: i,
        isDefault: false,
      })),
      skipDuplicates: true,
    })

    categories = await prisma.trainingCategory.findMany({
      where: { organizationId: dbUser!.organizationId! },
      orderBy: { order: 'asc' },
      select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
    })
  }

  return jsonResponse(categories, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createTrainingCategorySchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(firstIssue?.message ?? 'Geçersiz veri', 400)
  }

  const { label, icon, order } = parsed.data
  const value = toSlug(label)

  if (!value) {
    return errorResponse('Kategori adından geçerli bir slug üretilemedi', 400)
  }

  // Unique kontrolü
  const existing = await prisma.trainingCategory.findUnique({
    where: { organizationId_value: { organizationId: dbUser!.organizationId!, value } },
  })
  if (existing) {
    return errorResponse('Bu isimde bir kategori zaten mevcut', 409)
  }

  // En büyük order değerini bul (belirtilmemişse sona ekle)
  let nextOrder = order
  if (nextOrder === undefined) {
    const last = await prisma.trainingCategory.findFirst({
      where: { organizationId: dbUser!.organizationId! },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    nextOrder = (last?.order ?? -1) + 1
  }

  const category = await prisma.trainingCategory.create({
    data: {
      organizationId: dbUser!.organizationId!,
      value,
      label,
      icon,
      order: nextOrder,
      isDefault: false,
    },
    select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'training_category.create',
    entityType: 'training_category',
    entityId: category.id,
    newData: { label, icon, value },
    request,
  })

  return jsonResponse(category, 201)
}
