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

interface RolloverResult {
  orgId: string
  action: 'noop' | 'created' | 'rolled_over' | 'error'
  periodId?: string
  error?: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
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
