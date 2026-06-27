import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createTrainingCategorySchema } from '@/lib/validations'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { ensureDefaultTrainingCategories } from '@/lib/training-categories-seed'

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
  const categories = await prisma.trainingCategory.findMany({
    where: { organizationId },
    orderBy: { order: 'asc' },
    select: { id: true, value: true, label: true, icon: true, color: true, order: true, isDefault: true },
  })

  // DB boşsa: varsayılanları DB'ye YAZMADAN salt-okunur döndür (CLAUDE.md
  // "GET'te write YASAK"). id:null = henüz kalıcı değil. Wizard yalnız `value`
  // kullandığından sorunsuz çalışır; ayar sayfası id:null görünce seed
  // endpoint'ini tetikler. Kalıcı seed kategori ekleme (POST) ve org-kurulumda
  // yapılır (yeni org'lar zaten dolu gelir; bu fallback legacy/boş org köprüsü).
  if (categories.length === 0) {
    const defaults = TRAINING_CATEGORIES.map((cat, i) => ({
      id: null as string | null,
      value: cat.value,
      label: cat.label,
      icon: cat.icon,
      order: i,
      isDefault: true,
    }))
    return jsonResponse(defaults, 200, { 'Cache-Control': 'no-store' })
  }

  // Wizard'ın bu listeyi anlık görmesi gerekiyor (admin kategori ekledikten sonra
  // hemen "Yeni Eğitim"e geçebilir). 60s tarayıcı cache'i sihirbaz ile yönetim
  // sayfası arasında stale render'a yol açıyordu — no-store ile kapatıldı.
  return jsonResponse(categories, 200, { 'Cache-Control': 'no-store' })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createTrainingCategorySchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return errorResponse(firstIssue?.message ?? 'Geçersiz veri', 400)
  }

  const { label, icon, color, order } = parsed.data
  const value = toSlug(label)

  if (!value) {
    return errorResponse('Kategori adından geçerli bir slug üretilemedi', 400)
  }

  // GET artık seed etmiyor — DB boşsa önce varsayılanları kalıcılaştır ki order
  // hesabı ve sonraki düzenle/sil/sırala işlemleri gerçek id'lerle çalışsın.
  await ensureDefaultTrainingCategories(organizationId)

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
      color: color ?? null,
      order: nextOrder,
      isDefault: false,
    },
    select: { id: true, value: true, label: true, icon: true, color: true, order: true, isDefault: true },
  })

  await audit({
    action: 'training_category.create',
    entityType: 'training_category',
    entityId: category.id,
    newData: { label, icon, color, value },
  })

  return jsonResponse(category, 201)
}, { requireOrganization: true })
