import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
} from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { updateContentLibrarySchema } from '@/lib/validations'

/** GET /api/super-admin/content-library/[id] — tekil içerik + hangi hastaneler kurdu */
export const GET = withSuperAdminRoute<{ id: string }>(async ({ params }) => {
  const { id } = params

  const item = await prisma.contentLibrary.findUnique({
    where: { id },
    include: {
      installs: {
        include: {
          organization: { select: { id: true, name: true, code: true } },
          installer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { installedAt: 'desc' },
      },
      _count: { select: { installs: true } },
    },
  })

  if (!item) return errorResponse('İçerik bulunamadı', 404)

  return jsonResponse({
    ...item,
    targetRoles: item.targetRoles as string[],
    installCount: item._count.installs,
  })
})

/** PUT /api/super-admin/content-library/[id] — içeriği güncelle */
export const PUT = withSuperAdminRoute<{ id: string }>(async ({ request, params, audit }) => {
  const { id } = params

  const existing = await prisma.contentLibrary.findUnique({ where: { id } })
  if (!existing) return errorResponse('İçerik bulunamadı', 404)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = updateContentLibrarySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(`Hatalı bilgi: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400)
  }

  const updated = await prisma.contentLibrary.update({
    where: { id },
    data: parsed.data,
  })

  await audit({
    action: 'content_library.update',
    entityType: 'content_library',
    entityId: id,
    oldData: { title: existing.title, isActive: existing.isActive },
    newData: { title: updated.title, isActive: updated.isActive },
  })

  return jsonResponse({ ...updated, targetRoles: updated.targetRoles as string[] })
})
