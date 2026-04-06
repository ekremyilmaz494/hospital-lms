import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendSubscriptionExpiringEmail,
  sendSubscriptionExpiredEmail,
} from '@/lib/email'
import { logger } from '@/lib/logger'

const REMINDER_DAYS = [7, 3, 1] as const
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Abonelik / trial hatirlatma cron job'i.
 * Her gun 08:00 UTC'de calisir (Vercel Cron).
 * 7, 3, 1 gun kala uyari; suresi doldugunda bildirim gonderir.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  let sentCount = 0
  let errorCount = 0

  try {
    // Trial abonelikleri
    const trialSubscriptions = await prisma.organizationSubscription.findMany({
      where: {
        status: 'trial',
        trialEndsAt: { not: null },
      },
      include: {
        organization: { select: { name: true, email: true } },
      },
    })

    for (const sub of trialSubscriptions) {
      const adminEmail = sub.organization.email
      if (!adminEmail) continue

      const trialEnd = sub.trialEndsAt!
      const daysLeft = Math.ceil((trialEnd.getTime() - now) / DAY_MS)

      try {
        if (daysLeft <= 0) {
          // Trial suresi dolmus
          await sendTrialExpiredEmail(adminEmail, sub.organization.name)
          sentCount++
        } else if (REMINDER_DAYS.includes(daysLeft as 7 | 3 | 1)) {
          // Suresi dolmak uzere
          await sendTrialExpiringEmail(adminEmail, sub.organization.name, daysLeft)
          sentCount++
        }
      } catch (err) {
        errorCount++
        logger.error('cron:sub-reminders', 'Trial hatirlatma e-postasi gonderilemedi', {
          organizationId: sub.organizationId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Aktif abonelikler (paid)
    const activeSubscriptions = await prisma.organizationSubscription.findMany({
      where: {
        status: 'active',
        expiresAt: { not: null },
      },
      include: {
        organization: { select: { name: true, email: true } },
      },
    })

    for (const sub of activeSubscriptions) {
      const adminEmail = sub.organization.email
      if (!adminEmail) continue

      const expiresAt = sub.expiresAt!
      const daysLeft = Math.ceil((expiresAt.getTime() - now) / DAY_MS)

      try {
        if (daysLeft <= 0) {
          // Abonelik suresi dolmus
          await sendSubscriptionExpiredEmail(adminEmail, sub.organization.name)
          sentCount++
        } else if (REMINDER_DAYS.includes(daysLeft as 7 | 3 | 1)) {
          // Suresi dolmak uzere
          await sendSubscriptionExpiringEmail(adminEmail, sub.organization.name, daysLeft)
          sentCount++
        }
      } catch (err) {
        errorCount++
        logger.error('cron:sub-reminders', 'Abonelik hatirlatma e-postasi gonderilemedi', {
          organizationId: sub.organizationId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info('cron:sub-reminders', 'Abonelik hatirlatma cron tamamlandi', { sentCount, errorCount })

    return NextResponse.json({
      success: true,
      sentCount,
      errorCount,
    })
  } catch (err) {
    logger.error('cron:sub-reminders', 'Abonelik hatirlatma cron hatasi', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Cron job basarisiz oldu' },
      { status: 500 }
    )
  }
}
