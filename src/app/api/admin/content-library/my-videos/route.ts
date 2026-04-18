import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'
import { getStreamUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/content-library/my-videos
 *
 * Bu kurumda en az bir eğitimde kullanılmış ContentLibrary içeriklerini döndürür.
 * "Kullanım" ilişkisi Training.sourceLibraryId üzerinden kurulur.
 *
 * Sorgu parametreleri:
 *  - category: CONTENT_LIBRARY_CATEGORIES'den bir değer (opsiyonel)
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  try {
    // 1) Bu kurumdaki eğitimlere bağlı distinct content library ID'leri
    const linkedTrainings = await prisma.training.findMany({
      where: {
        organizationId: orgId,
        sourceLibraryId: { not: null },
      },
      select: { sourceLibraryId: true },
      distinct: ['sourceLibraryId'],
    })

    const libraryIds = linkedTrainings
      .map(t => t.sourceLibraryId)
      .filter((id): id is string => id !== null)

    if (libraryIds.length === 0) {
      return jsonResponse(
        { items: [] },
        200,
        { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      )
    }

    // 2) Kütüphane öğelerini ve kullanıldıkları eğitimlerin özetini paralel çek
    const where: Record<string, unknown> = {
      id: { in: libraryIds },
      isActive: true,
    }
    if (category) where.category = category

    const [items, trainingUsage] = await Promise.all([
      prisma.contentLibrary.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          thumbnailUrl: true,
          duration: true,
          smgPoints: true,
          difficulty: true,
          targetRoles: true,
          isActive: true,
          organizationId: true,
          contentType: true,
        },
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
      }),
      prisma.training.findMany({
        where: {
          organizationId: orgId,
          sourceLibraryId: { in: libraryIds },
        },
        select: {
          id: true,
          title: true,
          publishStatus: true,
          sourceLibraryId: true,
        },
      }),
    ])

    // sourceLibraryId → eğitim listesi haritası
    const usageMap = new Map<string, Array<{ id: string; title: string; publishStatus: string }>>()
    for (const t of trainingUsage) {
      if (!t.sourceLibraryId) continue
      const arr = usageMap.get(t.sourceLibraryId) ?? []
      arr.push({ id: t.id, title: t.title, publishStatus: t.publishStatus })
      usageMap.set(t.sourceLibraryId, arr)
    }

    // Thumbnail S3 key ise stream URL'e çevir
    const resolved = await Promise.all(
      items.map(async item => {
        let thumbnailUrl = item.thumbnailUrl
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          try {
            thumbnailUrl = await getStreamUrl(thumbnailUrl)
          } catch {
            thumbnailUrl = null
          }
        }
        const usedIn = usageMap.get(item.id) ?? []
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          thumbnailUrl,
          duration: item.duration,
          smgPoints: item.smgPoints,
          difficulty: item.difficulty,
          targetRoles: item.targetRoles as string[],
          isActive: item.isActive,
          contentType: item.contentType,
          isOwned: item.organizationId === orgId,
          usedInTrainings: usedIn,
          usageCount: usedIn.length,
        }
      }),
    )

    return jsonResponse(
      { items: resolved },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('content-library:my-videos', 'GET failed', { err, orgId })
    return jsonResponse({ error: 'İçerikler yüklenemedi' }, 500)
  }
}
