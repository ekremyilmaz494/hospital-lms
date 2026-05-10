import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * POST /api/admin/trainings/[id]/draft/append-video
 *
 * Upload manager'ın çağırdığı atomik endpoint. Bir video upload'ı tamamlandığı
 * anda draftData.videos array'ine append eder. Bu, kullanıcı wizard sayfasından
 * çıkıp başka admin sayfasındayken bile yüklenmenin biten dosyasının kalıcı
 * (server-side) olmasını sağlar — daha sonra wizard'a dönüldüğünde hydrate edilir.
 *
 * Niçin ayrı endpoint: Genel PATCH /draft full snapshot yazar; upload tamamlanma
 * anında wizard mount değilse snapshot yok, sadece tek video bilgisi var.
 * Read-modify-write transaction ile draftData içindeki videos listesine eklenir.
 */

const bodySchema = z.object({
  id: z.coerce.number().int(), // wizard'daki contentItemId
  title: z.string().max(500).default(''),
  url: z.string().min(1),
  contentType: z.enum(['video', 'pdf', 'audio']).default('video'),
  durationSeconds: z.number().int().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
})

interface DraftVideoSnapshot {
  id: number
  title: string
  url: string
  contentType: 'video' | 'pdf' | 'audio'
  durationSeconds?: number
  pageCount?: number
}

export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz veri', 400)

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return errorResponse('Geçersiz video verisi', 400)

  // Read-modify-write — kısa transaction (concurrent PATCH'lerden sonra append'in
  // kaybolmasını engellemek için tek kullanıcı senaryosunda bile transactional
  // yapıyoruz. Çoklu paralel upload'da Postgres row-level lock ile sıraya girer).
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const draft = await tx.training.findFirst({
        where: {
          id: params.id,
          organizationId,
          publishStatus: 'draft',
          ...(dbUser.role === 'super_admin' ? {} : { createdById: dbUser.id }),
        },
        select: { id: true, draftData: true },
      })
      if (!draft) return null

      const dd = (draft.draftData as Record<string, unknown> | null) ?? {}
      const existingVideos: DraftVideoSnapshot[] = Array.isArray(dd.videos)
        ? (dd.videos as DraftVideoSnapshot[])
        : []

      // Aynı id zaten varsa update, yoksa append (wizard mount'taysa state'iyle senkron kalsın)
      const idx = existingVideos.findIndex(v => v.id === parsed.data.id)
      const nextVideo: DraftVideoSnapshot = {
        id: parsed.data.id,
        title: parsed.data.title || parsed.data.url.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
        url: parsed.data.url,
        contentType: parsed.data.contentType,
        durationSeconds: parsed.data.durationSeconds,
        pageCount: parsed.data.pageCount,
      }
      const nextVideos = idx >= 0
        ? existingVideos.map((v, i) => i === idx ? { ...v, ...nextVideo } : v)
        : [...existingVideos, nextVideo]

      const nextDraftData = { ...dd, videos: nextVideos }

      await tx.training.update({
        where: { id: draft.id },
        data: {
          draftData: nextDraftData as unknown as Prisma.InputJsonValue,
          draftUpdatedAt: new Date(),
        },
      })
      return nextVideo
    })

    if (!updated) return errorResponse('Taslak bulunamadı', 404)
    return jsonResponse({ ok: true, video: updated })
  } catch (err) {
    return errorResponse((err as Error).message || 'Video eklenemedi', 500)
  }
}, { requireOrganization: true })
