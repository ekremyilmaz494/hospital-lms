import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { jsonResponse, parseBody, ApiError } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

/** GET /api/super-admin/licenses/[id] — detay: aktivasyonlar + son heartbeat'ler */
export const GET = withSuperAdminRoute<{ id: string }>(async ({ params }) => {
  const license = await prisma.license.findUnique({
    where: { id: params.id },
    include: {
      activations: { orderBy: { lastSeenAt: 'desc' } },
      heartbeats: { orderBy: { receivedAt: 'desc' }, take: 30 },
    },
  })
  if (!license) throw new ApiError('Lisans bulunamadı', 404)

  return jsonResponse(license, 200, {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
  })
})

const patchSchema = z.object({
  contactEmail: z.string().email().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

/** PATCH /api/super-admin/licenses/[id] — iletişim/notes güncelle (JWT alanlarına dokunmaz) */
export const PATCH = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const body = await parseBody<z.infer<typeof patchSchema>>(request)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) throw new ApiError('Geçersiz istek gövdesi', 400)

  const existing = await prisma.license.findUnique({
    where: { id: params.id },
    select: { contactEmail: true, notes: true },
  })
  if (!existing) throw new ApiError('Lisans bulunamadı', 404)

  const license = await prisma.license.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.contactEmail !== undefined ? { contactEmail: parsed.data.contactEmail } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  })

  await audit({
    action: 'license.update_meta',
    entityType: 'license',
    entityId: params.id,
    oldData: existing,
    newData: parsed.data,
  })

  return jsonResponse(license)
})
