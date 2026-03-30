import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncStaffFromHis } from '@/lib/his-integration'
import { logger } from '@/lib/logger'

/**
 * GET /api/cron/his-sync
 *
 * Vercel Cron tarafından her saat tetiklenir (vercel.json: "schedule": "0 * * * *").
 * Tüm aktif entegrasyonları kontrol eder, syncInterval'ı geçmiş olanları sync eder.
 *
 * Auth: Bearer {CRON_SECRET}
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const integrations = await prisma.hisIntegration.findMany({
    where: { isActive: true },
  })

  const results: Array<{
    integrationId: string
    organizationId: string
    triggered: boolean
    success?: boolean
    error?: string
  }> = []

  for (const integration of integrations) {
    // syncInterval kontrolü: son sync + interval < şimdi ise tetikle
    let shouldSync = true
    if (integration.lastSyncAt) {
      const nextSyncAt = new Date(
        integration.lastSyncAt.getTime() + integration.syncInterval * 60 * 1000
      )
      shouldSync = now >= nextSyncAt
    }

    if (!shouldSync) {
      results.push({
        integrationId: integration.id,
        organizationId: integration.organizationId,
        triggered: false,
      })
      continue
    }

    try {
      const result = await syncStaffFromHis(integration)
      results.push({
        integrationId: integration.id,
        organizationId: integration.organizationId,
        triggered: true,
        success: result.success,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('HIS Cron', 'Sync başarısız', { integrationId: integration.id, err: msg })
      results.push({
        integrationId: integration.id,
        organizationId: integration.organizationId,
        triggered: true,
        success: false,
        error: msg,
      })
    }
  }

  const triggered = results.filter(r => r.triggered).length

  return NextResponse.json({
    success: true,
    checkedAt: now.toISOString(),
    total: integrations.length,
    triggered,
    results,
  })
}
