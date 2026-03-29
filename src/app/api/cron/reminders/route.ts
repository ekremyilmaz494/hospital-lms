import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  upcomingTrainingReminderEmail,
  overdueTrainingReminderEmail,
  certificateExpiryReminderEmail,
} from '@/lib/email'
import { logger } from '@/lib/logger'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_DAYS = [3, 1] as const
const OVERDUE_MAX_DAYS = 7
const CERT_REMINDER_DAYS = [30, 14, 7, 3] as const
const BATCH_SIZE = 200

/** Automated reminder cron — runs daily at 07:00 UTC (10:00 Istanbul) */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  let upcomingEmailsSent = 0
  let overdueEmailsSent = 0
  let certEmailsSent = 0
  let notificationsCreated = 0

  // ── 1. YAKLAŞAN EĞİTİM DEADLINE HATIRLATMALARI (3 ve 1 gün kala) ──
  for (const daysLeft of REMINDER_DAYS) {
    const targetStart = new Date(now + daysLeft * DAY_MS)
    const targetEnd = new Date(now + (daysLeft + 1) * DAY_MS)

    const assignments = await prisma.trainingAssignment.findMany({
      where: {
        status: { in: ['assigned', 'in_progress'] },
        training: {
          isActive: true,
          endDate: { gte: targetStart, lt: targetEnd },
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
        training: { select: { id: true, title: true, endDate: true } },
      },
      take: BATCH_SIZE,
    })

    for (const a of assignments) {
      const staffName = `${a.user.firstName} ${a.user.lastName}`
      const dueDate = new Date(a.training.endDate).toLocaleDateString('tr-TR')

      try {
        await sendEmail({
          to: a.user.email,
          subject: daysLeft <= 1
            ? `SON GUN: "${a.training.title}" egitimi yarin sona eriyor!`
            : `Hatirlatma: "${a.training.title}" egitimi icin ${daysLeft} gun kaldi`,
          html: upcomingTrainingReminderEmail(staffName, a.training.title, dueDate, daysLeft),
        })
        upcomingEmailsSent++
      } catch (err) {
        logger.error('Cron Reminders', `Email gonderilemedi: ${a.user.email}`, (err as Error).message)
      }

      try {
        await prisma.notification.create({
          data: {
            userId: a.user.id,
            organizationId: a.user.organizationId,
            title: daysLeft <= 1 ? 'Son Gun Hatirlatmasi' : 'Egitim Hatirlatmasi',
            message: `"${a.training.title}" egitimi icin ${daysLeft} gun kaldi. Son tarih: ${dueDate}`,
            type: 'reminder',
            relatedTrainingId: a.training.id,
          },
        })
        notificationsCreated++
      } catch { /* notification hatası cron'u durdurmasın */ }
    }
  }

  // ── 2. GECİKMİŞ EĞİTİM HATIRLATMALARI (süre dolduktan sonra 7 güne kadar günlük) ──
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status: { in: ['assigned', 'in_progress', 'failed'] },
      training: {
        isActive: true,
        endDate: {
          lt: new Date(now),
          gte: new Date(now - OVERDUE_MAX_DAYS * DAY_MS),
        },
      },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
      training: { select: { id: true, title: true, endDate: true } },
    },
    take: BATCH_SIZE,
  })

  for (const a of overdueAssignments) {
    const staffName = `${a.user.firstName} ${a.user.lastName}`
    const dueDate = new Date(a.training.endDate).toLocaleDateString('tr-TR')
    const daysOverdue = Math.floor((now - new Date(a.training.endDate).getTime()) / DAY_MS)

    try {
      await sendEmail({
        to: a.user.email,
        subject: `Gecikmiş Egitim: "${a.training.title}" — ${daysOverdue} gun gecikti`,
        html: overdueTrainingReminderEmail(staffName, a.training.title, dueDate, daysOverdue),
      })
      overdueEmailsSent++
    } catch (err) {
      logger.error('Cron Reminders', `Overdue email gonderilemedi: ${a.user.email}`, (err as Error).message)
    }

    try {
      await prisma.notification.create({
        data: {
          userId: a.user.id,
          organizationId: a.user.organizationId,
          title: 'Gecikmiş Egitim Uyarisi',
          message: `"${a.training.title}" egitimi ${daysOverdue} gundur gecikmiş durumda. Lutfen en kisa surede tamamlayiniz.`,
          type: 'warning',
          relatedTrainingId: a.training.id,
        },
      })
      notificationsCreated++
    } catch { /* notification hatası cron'u durdurmasın */ }
  }

  // ── 3. SERTİFİKA YENİLEME HATIRLATMALARI (30, 14, 7, 3 gün kala) ──
  for (const daysLeft of CERT_REMINDER_DAYS) {
    const targetStart = new Date(now + daysLeft * DAY_MS)
    const targetEnd = new Date(now + (daysLeft + 1) * DAY_MS)

    const expiringCerts = await prisma.certificate.findMany({
      where: {
        expiresAt: { gte: targetStart, lt: targetEnd },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
        training: { select: { id: true, title: true } },
      },
      take: BATCH_SIZE,
    })

    for (const cert of expiringCerts) {
      if (!cert.expiresAt) continue
      const staffName = `${cert.user.firstName} ${cert.user.lastName}`
      const expiryDate = new Date(cert.expiresAt).toLocaleDateString('tr-TR')

      try {
        await sendEmail({
          to: cert.user.email,
          subject: `Sertifika Yenileme: "${cert.training.title}" — ${daysLeft} gun kaldi`,
          html: certificateExpiryReminderEmail(
            staffName,
            cert.training.title,
            expiryDate,
            daysLeft,
            `${process.env.NEXT_PUBLIC_APP_URL}/staff/my-trainings`,
          ),
        })
        certEmailsSent++
      } catch (err) {
        logger.error('Cron Reminders', `Cert email gonderilemedi: ${cert.user.email}`, (err as Error).message)
      }

      try {
        await prisma.notification.create({
          data: {
            userId: cert.user.id,
            organizationId: cert.user.organizationId,
            title: 'Sertifika Yenileme Hatirlatmasi',
            message: `"${cert.training.title}" sertifikanizin gecerlilik suresi ${daysLeft} gun icinde dolacak. Lutfen yenileme egitimini tamamlayiniz.`,
            type: daysLeft <= 7 ? 'warning' : 'reminder',
            relatedTrainingId: cert.training.id,
          },
        })
        notificationsCreated++
      } catch { /* notification hatası cron'u durdurmasın */ }
    }
  }

  logger.info('Cron Reminders', 'Hatirlatma cron tamamlandi', {
    upcomingEmailsSent,
    overdueEmailsSent,
    certEmailsSent,
    notificationsCreated,
  })

  return NextResponse.json({
    success: true,
    upcomingEmailsSent,
    overdueEmailsSent,
    certEmailsSent,
    notificationsCreated,
    timestamp: new Date().toISOString(),
  })
}
