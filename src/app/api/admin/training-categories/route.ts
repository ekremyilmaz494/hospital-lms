import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
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

export const GET = withAdminRoute(async ({ organizationId }) => {
  let categories = await prisma.trainingCategory.findMany({
    where: { organizationId },
    orderBy: { order: 'asc' },
    select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
  })

  // DB'de kayıt yoksa varsayılanları DB'ye seed'le (tek seferlik)
  if (categories.length === 0) {
    await prisma.trainingCategory.createMany({
      data: TRAINING_CATEGORIES.map((cat, i) => ({
        organizationId,
        value: cat.value,
        label: cat.label,
        icon: cat.icon,
        order: i,
        isDefault: false,
      })),
      skipDuplicates: true,
    })

    categories = await prisma.trainingCategory.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
      select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
    })
  }

  return jsonResponse(categories, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
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
    where: { organizationId_value: { organizationId, value } },
  })
  if (existing) {
    return errorResponse('Bu isimde bir kategori zaten mevcut', 409)
  }

  // En büyük order değerini bul (belirtilmemişse sona ekle)
  let nextOrder = order
  if (nextOrder === undefined) {
    const last = await prisma.trainingCategory.findFirst({
      where: { organizationId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    nextOrder = (last?.order ?? -1) + 1
  }

  const category = await prisma.trainingCategory.create({
    data: {
      organizationId,
      value,
      label,
      icon,
      order: nextOrder,
      isDefault: false,
    },
    select: { id: true, value: true, label: true, icon: true, order: true, isDefault: true },
  })

  await audit({
    action: 'training_category.create',
    entityType: 'training_category',
    entityId: category.id,
    newData: { label, icon, value },
  })

  return jsonResponse(category, 201)
}, { requireOrganization: true })
