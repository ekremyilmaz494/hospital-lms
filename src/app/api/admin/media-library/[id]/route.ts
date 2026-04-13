import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { deleteObject, getStreamUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/media-library/[id] — Oynatma/önizleme için signed URL üret
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const item = await prisma.contentLibrary.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, title: true, contentType: true, fileType: true, s3Key: true },
  })
  if (!item) return errorResponse('İçerik bulunamadı', 404)
  if (!item.s3Key) return errorResponse('Dosya yok', 404)

  const url = await getStreamUrl(item.s3Key)

  return jsonResponse(
    { id: item.id, title: item.title, contentType: item.contentType, fileType: item.fileType, url },
    200,
    { 'Cache-Control': 'private, max-age=60' },
  )
}

/**
 * PATCH /api/admin/media-library/[id] — Medya bilgilerini güncelle (title, category)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const item = await prisma.contentLibrary.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!item) return errorResponse('İçerik bulunamadı', 404)

  const body = await request.json() as { title?: string; category?: string; description?: string }

  const updated = await prisma.contentLibrary.update({
    where: { id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.category && { category: body.category }),
      ...(body.description !== undefined && { description: body.description }),
    },
    select: { id: true, title: true, category: true, description: true },
  })

  return jsonResponse(updated)
}

/**
 * DELETE /api/admin/media-library/[id] — Medya sil
 * Sadece hiçbir eğitimde kullanılmıyorsa silinir.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const item = await prisma.contentLibrary.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      s3Key: true,
      trainings: { select: { id: true, title: true } },
    },
  })

  if (!item) return errorResponse('İçerik bulunamadı', 404)

  if (item.trainings.length > 0) {
    const trainingNames = item.trainings.slice(0, 3).map(t => t.title).join(', ')
    return errorResponse(
      `Bu içerik ${item.trainings.length} eğitimde kullanılıyor (${trainingNames}). Önce eğitimlerden kaldırın.`,
      409,
    )
  }

  // S3'ten sil + DB'den sil
  await Promise.all([
    item.s3Key ? deleteObject(item.s3Key).catch(e => logger.warn('media-library', 'S3 silme hatası', e)) : Promise.resolve(),
    prisma.contentLibrary.delete({ where: { id } }),
  ])

  logger.info('media-library', 'Medya silindi', { id, orgId })

  return jsonResponse({ success: true })
}
