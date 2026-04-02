import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

/**
 * GET /api/admin/content-library/my-videos
 *
 * Kurum admin'inin kendi oluşturduğu eğitimleri, her eğitimin videoları
 * ile birlikte döndürür. İçerik kütüphanesi "Eğitim Videolarım" sekmesi
 * tarafından tüketilir.
 *
 * Sorgu parametreleri:
 *  - category: TRAINING_CATEGORIES'den bir değer (opsiyonel filtre)
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
    // Taslak eğitimler de dahil — admin kendi içeriklerini görür
  }

  if (category) where.category = category

  const trainings = await prisma.training.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      publishStatus: true,
      createdAt: true,
      videos: {
        select: {
          id: true,
          title: true,
          durationSeconds: true,
          sortOrder: true,
          videoUrl: true,
          description: true,
          createdAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  /** Sadece en az 1 videosu olan eğitimleri göster */
  const withVideos = trainings.filter(t => t.videos.length > 0)

  const result = withVideos.map(t => {
    const totalDurationSeconds = t.videos.reduce(
      (sum, v) => sum + v.durationSeconds,
      0,
    )
    return {
      id: t.id,
      title: t.title,
      category: t.category ?? 'genel',
      publishStatus: t.publishStatus,
      videoCount: t.videos.length,
      totalDurationSeconds,
      createdAt: t.createdAt.toISOString(),
      videos: t.videos.map(v => ({
        id: v.id,
        title: v.title,
        durationSeconds: v.durationSeconds,
        sortOrder: v.sortOrder,
        description: v.description,
        createdAt: v.createdAt.toISOString(),
      })),
    }
  })

  return jsonResponse({ trainings: result })
}
