import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * Wizard auto-save için draft state CRUD'ı.
 *
 * Ownership: Sadece taslağı yaratan kullanıcı (createdById) veya super_admin
 * okuyabilir/yazabilir. Bu, "başka adminin yarım taslağına müdahale" senaryosunu
 * engeller. publishStatus='published' olan kayıtlara bu route DOKUNMAZ —
 * Yayınlanmış eğitimi düzenleme akışı ayrı (`/admin/trainings/[id]/edit`).
 */

const patchBodySchema = z.object({
  draftData: z.unknown().optional(), // wizard state'in tam snapshot'ı (free-form JSON)
  draftStep: z.coerce.number().int().min(1).max(4).optional(),
})

async function findOwnedDraft(id: string, userId: string, isSuperAdmin: boolean, organizationId: string) {
  const draft = await prisma.training.findFirst({
    where: {
      id,
      organizationId,
      publishStatus: 'draft',
      ...(isSuperAdmin ? {} : { createdById: userId }),
    },
    select: {
      id: true, title: true, category: true,
      draftData: true, draftStep: true, draftUpdatedAt: true,
      createdById: true,
    },
  })
  return draft
}

export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const draft = await findOwnedDraft(params.id, dbUser.id, dbUser.role === 'super_admin', organizationId)
  if (!draft) return errorResponse('Taslak bulunamadı', 404)

  return jsonResponse(
    {
      id: draft.id,
      draftData: draft.draftData ?? null,
      draftStep: draft.draftStep ?? 1,
      updatedAt: draft.draftUpdatedAt?.toISOString() ?? null,
    },
    200,
    // Auto-save'in kendi PATCH'inden sonra hemen GET geleceği zorunluluğu yok;
    // hydration için kısa cache kabul edilebilir ama her zaman taze veri istenir,
    // bu yüzden no-store.
    { 'Cache-Control': 'no-store' },
  )
}, { requireOrganization: true })

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz veri', 400)

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) return errorResponse('Geçersiz taslak verisi', 400)

  const draft = await findOwnedDraft(params.id, dbUser.id, dbUser.role === 'super_admin', organizationId)
  if (!draft) return errorResponse('Taslak bulunamadı', 404)

  // Wizard JSON'u içinden başlık ve kategori string ise top-level kolonlara mirror'lanır;
  // taslaklar listesi bunları okur (drafts endpoint).
  let mirrorTitle: string | undefined
  let mirrorCategory: string | undefined
  const dd = parsed.data.draftData as Record<string, unknown> | undefined
  if (dd && typeof dd === 'object') {
    if (typeof dd.title === 'string') mirrorTitle = dd.title.slice(0, 500)
    if (typeof dd.selectedCategory === 'string') mirrorCategory = dd.selectedCategory.slice(0, 100)
  }

  await prisma.training.update({
    where: { id: draft.id },
    data: {
      ...(parsed.data.draftData !== undefined && { draftData: parsed.data.draftData as object }),
      ...(parsed.data.draftStep !== undefined && { draftStep: parsed.data.draftStep }),
      ...(mirrorTitle !== undefined && { title: mirrorTitle }),
      ...(mirrorCategory !== undefined && { category: mirrorCategory }),
      draftUpdatedAt: new Date(),
    },
  })

  // Audit her PATCH'te yazılmaz (debounced auto-save sayısı yüksek).
  // Onun yerine publish/discard anında audit kaydı atılır.
  void audit

  return jsonResponse({ ok: true, savedAt: new Date().toISOString() })
}, { requireOrganization: true })
