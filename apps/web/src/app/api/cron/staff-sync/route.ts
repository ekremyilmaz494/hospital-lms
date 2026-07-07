import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { assertCronAuth } from '@/lib/cron-auth'
import { runPullForIntegration } from '@/lib/integration/pull'

// Uzak İK API'leri yavaş olabilir (sayfa başına 30 sn timeout × 50 sayfa tavanı);
// Vercel varsayılanı yetmez.
export const maxDuration = 300

/**
 * Zamanlanmış İK/HBYS pull senkronu (Vercel Cron / on-prem supercronic — saatte bir).
 * Vadesi gelen (lastRunAt null veya pullIntervalMinutes'i aşmış) aktif pull
 * entegrasyonlarını sırayla koşar; her org izole (biri patlarsa diğerleri devam).
 */
export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const now = Date.now()
  const integrations = await prisma.staffIntegration.findMany({
    where: { channel: 'pull', isActive: true, pullBaseUrl: { not: null } },
    select: {
      id: true,
      organizationId: true,
      syncMode: true,
      deactivateMissing: true,
      deactivateThresholdPct: true,
      fieldMapping: true,
      defaults: true,
      pullBaseUrl: true,
      pullAuthType: true,
      pullCredentialsEncrypted: true,
      pullIntervalMinutes: true,
      pullPagination: true,
      lastRunAt: true,
    },
  })

  // Vade filtresi JS'te: "lastRunAt <= now - pullIntervalMinutes" satır-bazlı bir
  // kolona bağlı olduğundan tek Prisma where ile ifade edilemez; aktif pull config
  // sayısı küçüktür (org+channel unique → org başına en çok 1 satır).
  const due = integrations.filter((i) => {
    if (!i.lastRunAt) return true
    const intervalMs = (i.pullIntervalMinutes ?? 60) * 60_000
    return i.lastRunAt.getTime() <= now - intervalMs
  })

  let succeeded = 0
  let failed = 0
  // SIRALI koşum bilinçli: org sayısı küçük; eşzamanlı koşmak uzak İK API'lerine ve
  // Supabase auth çağrılarına gereksiz ani yük bindirir. İzolasyon runPullForIntegration
  // içinde ({ ok:false } döner, rethrow etmez); buradaki try/catch beklenmeyen bir
  // throw'a karşı ikinci emniyettir — bir entegrasyonun patlaması diğerlerini durdurmaz.
  for (const integration of due) {
    try {
      const result = await runPullForIntegration(integration, 'schedule')
      if (result.ok) succeeded++
      else failed++
    } catch (err) {
      failed++
      logger.error('staff-sync-cron', 'Pull entegrasyonu beklenmeyen hatayla düştü', {
        integrationId: integration.id,
        organizationId: integration.organizationId,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (due.length > 0) {
    logger.info('staff-sync-cron', 'Zamanlanmış pull senkronu tamamlandı', {
      processed: due.length, succeeded, failed,
    })
  }

  return NextResponse.json(
    { processed: due.length, succeeded, failed },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
