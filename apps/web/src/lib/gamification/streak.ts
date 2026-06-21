/**
 * Streak (günlük seri) motoru — server-clock (Europe/Istanbul), oyunlaştırma Faz 2.
 *
 * Model: `current` ardışık aktif gün, `lastActiveDate` son review günü (Istanbul
 * takvimi), `freezesLeft` kalan gün-atlama hakkı. Günlük review submit'i `touchStreak`
 * ile seriyi ilerletir; gece `streak-maintenance` cron'u kaçırılan günü freeze/reset eder.
 */

import type { Prisma } from '@/generated/prisma/client'
import { STREAK_FREEZES_DEFAULT } from './constants'
import {
  istanbulDateString,
  addDaysToDateString,
  dateStringToUTCDate,
  utcDateToDateString,
} from './timezone'

interface StreakRow {
  current: number
  longest: number
  lastActiveDate: Date | null
  freezesLeft: number
}

/**
 * Günlük review submit'inde seriyi ilerletir. Transaction client ile çağrılır
 * (DailySubmission/PointLedger ile atomik). Aynı gün ikinci submit → no-op.
 * Dünden devam → +1; aksi halde (boşluk/null) yeni seri = 1.
 */
export async function touchStreak(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<void> {
  const today = istanbulDateString(now)
  const yesterday = addDaysToDateString(today, -1)

  const streak = await tx.userStreak.findUnique({ where: { userId } })
  if (!streak) {
    await tx.userStreak.create({
      data: {
        userId,
        organizationId,
        current: 1,
        longest: 1,
        lastActiveDate: dateStringToUTCDate(today),
        freezesLeft: STREAK_FREEZES_DEFAULT,
      },
    })
    return
  }

  const lastStr = streak.lastActiveDate ? utcDateToDateString(streak.lastActiveDate) : null
  if (lastStr === today) return // bugün zaten aktif

  const current = lastStr === yesterday ? streak.current + 1 : 1
  const longest = Math.max(streak.longest, current)
  await tx.userStreak.update({
    where: { userId },
    data: { current, longest, lastActiveDate: dateStringToUTCDate(today) },
  })
}

/**
 * Seri bugün risk altında mı? current>0 ve bugün henüz aktif değilse true
 * (kullanıcı bugün review yapmazsa seri kırılır). `summary` GET'inde türetilir —
 * cron ile GET arasında tek doğruluk kaynağı `lastActiveDate`.
 */
export function computeAtRisk(streak: StreakRow | null, now: Date = new Date()): boolean {
  if (!streak || streak.current <= 0) return false
  const today = istanbulDateString(now)
  const lastStr = streak.lastActiveDate ? utcDateToDateString(streak.lastActiveDate) : null
  return lastStr !== today
}
