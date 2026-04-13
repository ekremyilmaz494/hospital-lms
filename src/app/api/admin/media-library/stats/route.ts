import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

/**
 * GET /api/admin/media-library/stats
 * Media library widget'ları için aggregate metrikler.
 * NOT: contentLibrary schema'sında fileSizeBytes yok — storage tahmini duration'a göre hesaplanır.
 *   Video:  ~8 MB/dakika
 *   Audio:  ~1 MB/dakika
 *   PDF:    ~2 MB/adet (duration=0)
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const baseWhere = { organizationId: orgId, isActive: true }

  const [totalCount, typeGroups, olderCount, recent7dCount] = await Promise.all([
    prisma.contentLibrary.count({ where: baseWhere }),
    prisma.contentLibrary.groupBy({
      by: ['contentType'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { duration: true },
    }),
    prisma.contentLibrary.count({ where: { ...baseWhere, createdAt: { lt: thirtyDaysAgo } } }),
    prisma.contentLibrary.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
  ])

  // Tür bazlı sayılar ve tahmini boyut
  let videoCount = 0
  let audioCount = 0
  let pdfCount = 0
  let storageBytes = 0

  for (const g of typeGroups) {
    const count = g._count._all
    const minutes = g._sum.duration ?? 0
    if (g.contentType === 'video') {
      videoCount = count
      storageBytes += minutes * 8 * 1024 * 1024
    } else if (g.contentType === 'audio') {
      audioCount = count
      storageBytes += minutes * 1 * 1024 * 1024
    } else if (g.contentType === 'pdf') {
      pdfCount = count
      storageBytes += count * 2 * 1024 * 1024
    }
  }

  // 30 günlük trend: newCount / olderCount
  const newIn30d = totalCount - olderCount
  const trendPct = olderCount > 0 ? Math.round((newIn30d / olderCount) * 1000) / 10 : (newIn30d > 0 ? 100 : 0)

  return jsonResponse(
    {
      totalAssets: totalCount,
      videoCount,
      audioCount,
      pdfCount,
      storageBytes,
      storageEstimated: true,
      trend30d: { pct: Math.abs(trendPct), isPositive: trendPct >= 0 },
      recent7d: recent7dCount,
    },
    200,
    { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  )
}
