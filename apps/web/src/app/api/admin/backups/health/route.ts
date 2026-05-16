import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'

/**
 * GET /api/admin/backups/health
 *
 * Yedek sisteminin sağlık göstergeleri — /admin/backups dashboard'unda
 * 4 KPI kartı bunu okur. Hızlı, sade aggregate query'ler:
 *  - Son 7 gün: toplam, başarılı, oran
 *  - Son tamamlanan yedek (timestamp)
 *  - Son verify edilen yedek (verified=true) timestamp'i
 *  - Toplam yedek sayısı + toplam boyut
 *
 * Önemli: kurum (organizationId) bazında filtreli; bir admin sadece kendi
 * kurumunun health verisini görür.
 */
export const GET = withAdminRoute(async ({ organizationId }) => {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [recent7d, lastCompleted, lastVerified, totals] = await Promise.all([
    // Son 7 gün — completed/failed/verification_failed sayılarını groupBy ile topla
    prisma.dbBackup.groupBy({
      by: ['status'],
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.dbBackup.findFirst({
      where: { organizationId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, fileSizeMb: true, backupType: true },
    }),
    prisma.dbBackup.findFirst({
      where: { organizationId, verified: true },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.dbBackup.aggregate({
      where: { organizationId },
      _count: { _all: true },
      _sum: { fileSizeMb: true },
    }),
  ])

  const recent7dByStatus: Record<string, number> = {}
  let recent7dTotal = 0
  for (const r of recent7d) {
    recent7dByStatus[r.status] = r._count._all
    recent7dTotal += r._count._all
  }
  const recent7dCompleted = recent7dByStatus['completed'] ?? 0
  const successRate7d = recent7dTotal > 0 ? Math.round((recent7dCompleted / recent7dTotal) * 100) : null

  // Son verify edilen yedek "stale" mi (örn. 36 saatten eski)? — günlük cron varsa
  // 24 saatten taze olması beklenir; 36 saat eşik, gecikme tolere edilir.
  const lastVerifiedAgeHours = lastVerified
    ? Math.round((now.getTime() - lastVerified.createdAt.getTime()) / (60 * 60 * 1000))
    : null
  const verifyStale = lastVerifiedAgeHours === null || lastVerifiedAgeHours > 36

  // Son completed yedek "stale" mi (>30 saat = 1 gün + 6 saat tolerans)
  const lastCompletedAgeHours = lastCompleted
    ? Math.round((now.getTime() - lastCompleted.createdAt.getTime()) / (60 * 60 * 1000))
    : null
  const completedStale = lastCompletedAgeHours === null || lastCompletedAgeHours > 30

  // Genel sağlık skoru: 7 gün başarı + verify tazelik + son yedek tazelik
  let healthLevel: 'healthy' | 'warning' | 'critical' = 'healthy'
  const healthIssues: string[] = []
  if (completedStale) {
    healthLevel = 'critical'
    healthIssues.push(lastCompletedAgeHours === null
      ? 'Hiç tamamlanmış yedek yok'
      : `Son yedek ${lastCompletedAgeHours} saat önce — günlük cron gecikti veya başarısız`)
  }
  if (successRate7d !== null && successRate7d < 100) {
    if (healthLevel !== 'critical') healthLevel = successRate7d < 80 ? 'critical' : 'warning'
    healthIssues.push(`Son 7 gün başarı oranı: ${successRate7d}%`)
  }
  if (verifyStale && lastVerified) {
    if (healthLevel === 'healthy') healthLevel = 'warning'
    healthIssues.push(`Son doğrulama ${lastVerifiedAgeHours} saat önce yapılmış`)
  } else if (!lastVerified && totals._count._all > 0) {
    if (healthLevel === 'healthy') healthLevel = 'warning'
    healthIssues.push('Hiçbir yedek doğrulama testinden geçmemiş (verified=false)')
  }

  return jsonResponse({
    healthLevel,
    healthIssues,
    last7Days: {
      total: recent7dTotal,
      completed: recent7dCompleted,
      failed: recent7dByStatus['failed'] ?? 0,
      verificationFailed: recent7dByStatus['verification_failed'] ?? 0,
      successRate: successRate7d, // null = veri yok
    },
    lastBackup: lastCompleted ? {
      at: lastCompleted.createdAt.toISOString(),
      sizeMb: lastCompleted.fileSizeMb ? Number(lastCompleted.fileSizeMb) : null,
      type: lastCompleted.backupType,
      ageHours: lastCompletedAgeHours,
    } : null,
    lastVerified: lastVerified ? {
      at: lastVerified.createdAt.toISOString(),
      ageHours: lastVerifiedAgeHours,
    } : null,
    totals: {
      count: totals._count._all,
      sizeMb: totals._sum.fileSizeMb ? Number(totals._sum.fileSizeMb) : 0,
    },
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })
