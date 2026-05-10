import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { invalidateOrgCache } from '@/lib/redis'

/**
 * POST /api/admin/trainings/draft
 *
 * Idempotent: Bir kullanıcının aynı anda yalnızca tek bir aktif taslağı olabilir.
 *  - Mevcut taslak varsa onun id'si döner (yeni satır yaratılmaz). Kullanıcı
 *    "Yeni Eğitim" butonuna her tıkladığında kaldığı yere döner.
 *  - Yoksa yeni boş taslak yaratılır.
 *
 * Yayın limit kontrolü yalnızca yeni satır yaratırken çalışır (var olan taslak
 * zaten limit içinde sayılmış).
 */
export const POST = withAdminRoute(async ({ dbUser, organizationId, audit }) => {
  // Önce var olan taslak — single-draft kuralı
  const existing = await prisma.training.findFirst({
    where: {
      organizationId,
      createdById: dbUser.id,
      publishStatus: 'draft',
    },
    orderBy: { draftUpdatedAt: 'desc' },
    select: { id: true },
  })
  if (existing) {
    return jsonResponse({ id: existing.id, existing: true }, 200)
  }

  const limitError = await checkSubscriptionLimit(organizationId, 'training')
  if (limitError) return limitError

  const now = new Date()
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  try {
    const draft = await prisma.training.create({
      data: {
        organizationId,
        createdById: dbUser.id,
        title: '',
        // Required NOT NULL kolonlar — yayında validation üzerinde tekrar kontrol edilir.
        startDate: now,
        endDate: inThirtyDays,
        publishStatus: 'draft',
        // isActive=true: liste endpoint'i (`/api/admin/trainings`) varsayılan olarak
        // isActive=true filtresi uyguluyor; false bırakırsak taslak listede görünmez
        // ve kullanıcı yarıda bıraktığı eğitime erişemez. Staff tarafında zaten
        // publishStatus='published' filtresi uygulandığı için draft satırları
        // personele sızmaz.
        isActive: true,
        draftStep: 1,
        draftUpdatedAt: now,
      },
      select: { id: true },
    })

    await audit({
      action: 'training.draft.create',
      entityType: 'training',
      entityId: draft.id,
    })

    // Eğitimler liste endpoint'i Redis'te 120 sn cache'liyor — invalidate
    // edilmezse yeni taslak listeye 2 dk gelmez ve kullanıcı taslağı göremez.
    try { await invalidateOrgCache(organizationId, 'trainings') } catch {}

    return jsonResponse({ id: draft.id }, 201)
  } catch (err) {
    return errorResponse((err as Error).message || 'Taslak oluşturulamadı', 500)
  }
}, { requireOrganization: true })
