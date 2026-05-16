import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getStreamUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/content-library/my-videos
 *
 * Kuruma yüklenmiş TÜM ContentLibrary item'larını döner — eğitime atanmış olsun
 * olmasın. Her item için, varsa, kullanıldığı eğitimlerin özeti `usedInTrainings`
 * alanında gelir; kullanılmayanlar boş dizi + usageCount=0 olarak döner.
 *
 * Sorgu parametreleri:
 *  - category: CONTENT_LIBRARY_CATEGORIES'den bir değer (opsiyonel)
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  try {
    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
    }
    if (category) where.category = category

    // Önce kurumun tüm yüklemelerini, sonra bu item'ları kullanan eğitimleri
    // paralel çekiyoruz. usageMap ile O(1) eşleştirme yapıyoruz.
    const items = await prisma.contentLibrary.findMany({
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
    })

    if (items.length === 0) {
      return jsonResponse(
        { items: [] },
        200,
        { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      )
    }

    const ids = items.map(i => i.id)
    const trainingUsage = await prisma.training.findMany({
      where: {
        organizationId,
        sourceLibraryId: { in: ids },
      },
      select: {
        id: true,
        title: true,
        publishStatus: true,
        sourceLibraryId: true,
      },
    })

    const usageMap = new Map<string, Array<{ id: string; title: string; publishStatus: string }>>()
    for (const t of trainingUsage) {
      if (!t.sourceLibraryId) continue
      const arr = usageMap.get(t.sourceLibraryId) ?? []
      arr.push({ id: t.id, title: t.title, publishStatus: t.publishStatus })
      usageMap.set(t.sourceLibraryId, arr)
    }

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
          isOwned: item.organizationId === organizationId,
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
    logger.error('content-library:my-videos', 'GET failed', { err, orgId: organizationId })
    return jsonResponse({ error: 'İçerikler yüklenemedi' }, 500)
  }
}, { requireOrganization: true })
