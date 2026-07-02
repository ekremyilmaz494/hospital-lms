/**
 * Yıllık eğitim dönemi rollover cron'u (1 Ocak 01:00 UTC = TR 04:00).
 *
 * Tüm aktif organizasyonları gezer, her biri için `rolloverIfNeeded` çağırır.
 * Idempotent — aynı yıla 2. kez çalıştırılırsa no-op döner.
 * Wrapper YOK; CRON_SECRET ile manuel auth (cleanup cron pattern'i).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rolloverIfNeeded } from '@/lib/training-periods'
import { logger } from '@/lib/logger'
import { assertCronAuth } from '@/lib/cron-auth'
import { isBusinessCronAllowed } from '@/lib/license/enforcement'

interface RolloverResult {
  orgId: string
  action: 'noop' | 'created' | 'rolled_over' | 'error'
  periodId?: string
  error?: string
}

export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  // On-prem: READONLY/LOCKED'ta iş cron'ları atlanır (yalnız altyapı cron'ları çalışır). Bulutta no-op.
  if (!(await isBusinessCronAllowed())) {
    return NextResponse.json({ ok: true, skipped: 'license' }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Sadece aktif + askıya alınmamış organizasyonlar için rollover yap.
  const orgs = await prisma.organization.findMany({
    where: { isActive: true, isSuspended: false },
    select: { id: true },
  })

  const currentYear = new Date().getFullYear()
  const results: RolloverResult[] = []

  for (const org of orgs) {
    try {
      const r = await rolloverIfNeeded(org.id, currentYear)
      results.push({
        orgId: org.id,
        action: r.action,
        periodId: r.period?.id,
      })
    } catch (err) {
      logger.error('cron.period-rollover', 'rollover failed for org', {
        orgId: org.id,
        error: err instanceof Error ? err.message : String(err),
      })
      results.push({
        orgId: org.id,
        action: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json(
    {
      success: true,
      year: currentYear,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
