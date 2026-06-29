import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'

async function requireRealOrganization(organizationId: string) {
  return prisma.organization.findFirst({
    where: { id: organizationId, isDemo: false },
    select: { id: true },
  })
}

export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')?.trim()
  if (!organizationId) return errorResponse('Yedek sağlığı için kurum seçilmelidir', 400)
  const organization = await requireRealOrganization(organizationId)
  if (!organization) return errorResponse('Kurum bulunamadı veya demo kurumlar yedek paneline dahil değil', 404)

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [recent7d, lastCompleted, lastVerified, totals] = await Promise.all([
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
  const recent7dCompleted = recent7dByStatus.completed ?? 0
  const successRate7d = recent7dTotal > 0 ? Math.round((recent7dCompleted / recent7dTotal) * 100) : null

  const lastVerifiedAgeHours = lastVerified
    ? Math.round((now.getTime() - lastVerified.createdAt.getTime()) / (60 * 60 * 1000))
    : null
  const verifyStale = lastVerifiedAgeHours === null || lastVerifiedAgeHours > 36
  const lastCompletedAgeHours = lastCompleted
    ? Math.round((now.getTime() - lastCompleted.createdAt.getTime()) / (60 * 60 * 1000))
    : null
  const completedStale = lastCompletedAgeHours === null || lastCompletedAgeHours > 30

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
      failed: recent7dByStatus.failed ?? 0,
      verificationFailed: recent7dByStatus.verification_failed ?? 0,
      successRate: successRate7d,
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
  }, 200, { 'Cache-Control': 'private, no-store' })
})
