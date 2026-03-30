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
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()

  // Deduplication: bugün zaten gönderilmiş bildirimleri atla
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  async function alreadyNotified(userId: string, type: string, trainingId: string): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
      where: { userId, type, relatedTrainingId: trainingId, createdAt: { gte: todayStart, lt: todayEnd } },
    })
    return !!existing
  }

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
            ? `SON GÜN: "${a.training.title}" eğitimi yarın sona eriyor!`
            : `Hatırlatma: "${a.training.title}" eğitimi için ${daysLeft} gün kaldı`,
          html: upcomingTrainingReminderEmail(staffName, a.training.title, dueDate, daysLeft),
        })
        upcomingEmailsSent++
      } catch (err) {
        logger.error('Cron Reminders', `Email gonderilemedi: ${a.user.email}`, (err as Error).message)
      }

      if (await alreadyNotified(a.user.id, 'reminder', a.training.id)) continue
      try {
        await prisma.notification.create({
          data: {
            userId: a.user.id,
            organizationId: a.user.organizationId,
            title: daysLeft <= 1 ? 'Son Gün Hatırlatması' : 'Eğitim Hatırlatması',
            message: `"${a.training.title}" eğitimi için ${daysLeft} gün kaldı. Son tarih: ${dueDate}`,
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
        subject: `Gecikmiş Eğitim: "${a.training.title}" — ${daysOverdue} gün gecikti`,
        html: overdueTrainingReminderEmail(staffName, a.training.title, dueDate, daysOverdue),
      })
      overdueEmailsSent++
    } catch (err) {
      logger.error('Cron Reminders', `Overdue email gonderilemedi: ${a.user.email}`, (err as Error).message)
    }

    if (await alreadyNotified(a.user.id, 'warning', a.training.id)) continue
    try {
      await prisma.notification.create({
        data: {
          userId: a.user.id,
          organizationId: a.user.organizationId,
          title: 'Gecikmiş Eğitim Uyarısı',
          message: `"${a.training.title}" eğitimi ${daysOverdue} gündür gecikmiş durumda. Lütfen en kısa sürede tamamlayınız.`,
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
        training: { organization: { isActive: true, isSuspended: false } },
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

      const certNotifType = daysLeft <= 7 ? 'warning' : 'reminder'
      if (await alreadyNotified(cert.user.id, certNotifType, cert.training.id)) continue
      try {
        await prisma.notification.create({
          data: {
            userId: cert.user.id,
            organizationId: cert.user.organizationId,
            title: 'Sertifika Yenileme Hatırlatması',
            message: `"${cert.training.title}" sertifikanızın geçerlilik süresi ${daysLeft} gün içinde dolacak. Lütfen yenileme eğitimini tamamlayınız.`,
            type: certNotifType,
            relatedTrainingId: cert.training.id,
          },
        })
        notificationsCreated++
      } catch { /* notification hatası cron'u durdurmasın */ }
    }
  }

  // ── 4. SERTİFİKA SÜRESİ DOLMUŞ EĞİTİMLERİ YENİDEN ATA (renewalPeriodMonths) ──
  let renewalReassigned = 0
  const expiredCerts = await prisma.certificate.findMany({
    where: {
      expiresAt: {
        lt: new Date(now),
        gte: new Date(now - DAY_MS), // sadece bugün dolanlar (günlük cron, tekrarı önler)
      },
      training: { organization: { isActive: true, isSuspended: false } },
    },
    include: {
      training: { select: { id: true, title: true, renewalPeriodMonths: true, isActive: true, endDate: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
    },
    take: BATCH_SIZE,
  })

  for (const cert of expiredCerts) {
    // Sadece renewalPeriodMonths tanımlı ve eğitim aktif ise yeniden ata
    if (!cert.training.renewalPeriodMonths || !cert.training.isActive) continue

    // Zaten atanmış mı? (aktif atama var mı)
    const existingAssignment = await prisma.trainingAssignment.findUnique({
      where: { trainingId_userId: { trainingId: cert.training.id, userId: cert.user.id } },
    })
    if (existingAssignment && existingAssignment.status !== 'passed') continue

    try {
      // Mevcut atamayı sıfırla veya yeni oluştur
      if (existingAssignment) {
        await prisma.trainingAssignment.update({
          where: { id: existingAssignment.id },
          data: { status: 'assigned', currentAttempt: 0, completedAt: null },
        })
      } else {
        await prisma.trainingAssignment.create({
          data: { trainingId: cert.training.id, userId: cert.user.id, status: 'assigned' },
        })
      }

      await prisma.notification.create({
        data: {
          userId: cert.user.id,
          organizationId: cert.user.organizationId,
          title: 'Sertifika Yenileme Gerekli',
          message: `"${cert.training.title}" sertifikanızın süresi doldu. Eğitimi tekrar tamamlamanız gerekmektedir.`,
          type: 'warning',
          relatedTrainingId: cert.training.id,
        },
      })
      renewalReassigned++
    } catch (err) {
      logger.warn('Cron Reminders', `Yenileme atamasi basarisiz: ${cert.user.id}`, (err as Error).message)
    }
  }

  logger.info('Cron Reminders', 'Hatirlatma cron tamamlandi', {
    upcomingEmailsSent,
    overdueEmailsSent,
    certEmailsSent,
    notificationsCreated,
    renewalReassigned,
  })

  return NextResponse.json({
    success: true,
    upcomingEmailsSent,
    overdueEmailsSent,
    certEmailsSent,
    notificationsCreated,
    renewalReassigned,
    timestamp: new Date().toISOString(),
  })
}
