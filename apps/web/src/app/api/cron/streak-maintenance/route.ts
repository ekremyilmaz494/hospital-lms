import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { istanbulDateString, addDaysToDateString, dateStringToUTCDate } from '@/lib/gamification/timezone'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/cron/streak-maintenance — Gece streak bakım/freeze cron'u.
 * Vercel Cron: `5 21 * * *` (21:05 UTC = 00:05 Europe/Istanbul) — Istanbul günü yeni
 * bittikten sonra, DÜNÜN aktivitesini değerlendirir.
 *
 * Dün review YAPMAYAN (lastActiveDate < dün) ve serisi süren (current>0) personel için:
 *  - freezesLeft > 0 → bir freeze tüket, lastActiveDate=dün ile boşluğu kapat (seri korunur).
 *  - freezesLeft = 0 → seri sıfırlanır (current=0).
 * `atRisk` ayrı kolon değildir — `summary` GET'inde `lastActiveDate`'ten türetilir.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const now = new Date()
  const yesterday = dateStringToUTCDate(addDaysToDateString(istanbulDateString(now), -1))
  const missedYesterday = { current: { gt: 0 }, lastActiveDate: { lt: yesterday } }

  // Önce freeze HAKKI OLMAYANLARI sıfırla (lastActiveDate'i değiştirmez → freeze adımıyla çakışmaz).
  const reset = await prisma.userStreak.updateMany({
    where: { ...missedYesterday, freezesLeft: { lte: 0 } },
    data: { current: 0 },
  })
  // Sonra freeze hakkı olanların freeze'ini tüket, dünü "doldur" (seri devam eder).
  const frozen = await prisma.userStreak.updateMany({
    where: { ...missedYesterday, freezesLeft: { gt: 0 } },
    data: { freezesLeft: { decrement: 1 }, lastActiveDate: yesterday },
  })

  logger.info('streak-maintenance', 'Cron tamamlandı', { reset: reset.count, frozen: frozen.count })
  return NextResponse.json({ ok: true, reset: reset.count, frozen: frozen.count }, { headers: NO_STORE })
}
