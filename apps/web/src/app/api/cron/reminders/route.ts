import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  upcomingTrainingReminderEmail,
  overdueTrainingReminderEmail,
  certificateExpiryReminderEmail,
} from '@/lib/email'
import { logger } from '@/lib/logger'
import { maskEmail } from '@/lib/pii-mask'
import { findActivePeriod } from '@/lib/training-periods'
import { sendExpoPushToUser } from '@/lib/expo-push'
import { assertCronAuth } from '@/lib/cron-auth'

const DAY_MS = 24 * 60 * 60 * 1000
// Son-gün hatırlatması — org ayarından bağımsız, herkese gider (deadline'a 1 gün kala).
const URGENT_REMINDER_DAY = 1
const OVERDUE_MAX_DAYS = 7
const CERT_REMINDER_DAYS = [30, 14, 7, 3] as const
const BATCH_SIZE = 200

/** Automated reminder cron — runs daily at 07:00 UTC (10:00 Istanbul) */
export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  const now = Date.now()

  // Deduplication: bugün zaten gönderilmiş bildirimleri atla
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  async function alreadyNotified(userId: string, type: string, trainingId: string): Promise<boolean> {
    const existing = await prisma.notification.findFirst({ // perf-check-disable-line
      where: { userId, type, relatedTrainingId: trainingId, createdAt: { gte: todayStart, lt: todayEnd } },
    })
    return !!existing
  }

  // Org bildirim ayarları (Ayarlar → Bildirim sekmesi). emailNotifications: hatırlatma
  // e-postası gate'i (in-app bildirim + push ETKİLENMEZ). reminderDaysBefore: yaklaşan
  // deadline hatırlatması kaç gün önce gönderilsin (default 3 = eski davranış).
  const orgs = await prisma.organization.findMany({
    select: { id: true, emailNotifications: true, reminderDaysBefore: true },
  })
  const orgPrefs = new Map(orgs.map(o => [o.id, o]))
  const emailAllowed = (orgId: string | null): boolean =>
    orgId ? orgPrefs.get(orgId)?.emailNotifications !== false : true
  // Yaklaşan-hatırlatma günleri: her org'un kendi reminderDaysBefore'u + her zaman son-gün (1).
  // Tüm org'lar default reminderDaysBefore=3 olduğundan set {3,1} olur — eski davranış birebir korunur.
  const reminderDays = [...new Set<number>([...orgs.map(o => o.reminderDaysBefore), URGENT_REMINDER_DAY])]

  let upcomingEmailsSent = 0
  let overdueEmailsSent = 0
  let certEmailsSent = 0
  let notificationsCreated = 0

  // Aktif period scope — her org için ayrı aktif period; assignment.period
  // ilişkisi üzerinden status='active' filtre yeterli (yoksa skip).
  const activePeriodFilter = { period: { status: 'active' as const } }

  // ── 1. YAKLAŞAN EĞİTİM DEADLINE HATIRLATMALARI (org'un reminderDaysBefore'u + son gün) ──
  for (const daysLeft of reminderDays) {
    const targetStart = new Date(now + daysLeft * DAY_MS)
    const targetEnd = new Date(now + (daysLeft + 1) * DAY_MS)

    // 2. tur açıldığında atamanın kendi dueDate'i öncelikli; aksi halde training.endDate fallback.
    const assignments = await prisma.trainingAssignment.findMany({ // perf-check-disable-line
      where: {
        status: { in: ['assigned', 'in_progress'] },
        ...activePeriodFilter,
        training: { isActive: true },
        OR: [
          { dueDate: { gte: targetStart, lt: targetEnd } },
          {
            AND: [
              { dueDate: null },
              { training: { endDate: { gte: targetStart, lt: targetEnd } } },
            ],
          },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
        training: { select: { id: true, title: true, endDate: true } },
      },
      take: BATCH_SIZE,
    })

    for (const a of assignments) {
      // Bu org bu gün için hatırlatma istiyor mu? Kendi reminderDaysBefore'u VEYA son-gün (1).
      // (Sorgu tüm org'ları çekiyor; org-özel günde olmayanları burada eliyoruz.)
      const orgId = a.user.organizationId
      const orgRDB = orgId ? (orgPrefs.get(orgId)?.reminderDaysBefore ?? 3) : 3
      if (daysLeft !== URGENT_REMINDER_DAY && daysLeft !== orgRDB) continue

      const staffName = `${a.user.firstName} ${a.user.lastName}`
      const effective = a.dueDate ?? a.training.endDate
      const dueDate = new Date(effective).toLocaleDateString('tr-TR')

      // emailNotifications=false ise e-posta atlanır; in-app bildirim yine gönderilir.
      if (emailAllowed(a.user.organizationId)) {
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
          logger.error('Cron Reminders', `Email gonderilemedi: ${maskEmail(a.user.email)}`, (err as Error).message)
        }
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
        void sendExpoPushToUser(a.user.id, {
          title: daysLeft <= 1 ? 'Son Gün!' : 'Eğitim Hatırlatması',
          body: `"${a.training.title}" için ${daysLeft} gün kaldı`,
          url: `/trainings/${a.training.id}`,
        })
      } catch { /* notification hatası cron'u durdurmasın */ }
    }
  }

  // ── 2. GECİKMİŞ EĞİTİM HATIRLATMALARI (süre dolduktan sonra 7 güne kadar günlük) ──
  const overdueWindowStart = new Date(now - OVERDUE_MAX_DAYS * DAY_MS)
  const overdueWindowEnd = new Date(now)
  const overdueAssignments = await prisma.trainingAssignment.findMany({ // perf-check-disable-line
    where: {
      status: { in: ['assigned', 'in_progress', 'failed'] },
      ...activePeriodFilter,
      training: { isActive: true },
      OR: [
        { dueDate: { lt: overdueWindowEnd, gte: overdueWindowStart } },
        {
          AND: [
            { dueDate: null },
            { training: { endDate: { lt: overdueWindowEnd, gte: overdueWindowStart } } },
          ],
        },
      ],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, organizationId: true } },
      training: { select: { id: true, title: true, endDate: true } },
    },
    take: BATCH_SIZE,
  })

  for (const a of overdueAssignments) {
    const staffName = `${a.user.firstName} ${a.user.lastName}`
    const effective = a.dueDate ?? a.training.endDate
    const dueDate = new Date(effective).toLocaleDateString('tr-TR')
    const daysOverdue = Math.floor((now - new Date(effective).getTime()) / DAY_MS)

    if (emailAllowed(a.user.organizationId)) {
      try {
        await sendEmail({
          to: a.user.email,
          subject: `Gecikmiş Eğitim: "${a.training.title}" — ${daysOverdue} gün gecikti`,
          html: overdueTrainingReminderEmail(staffName, a.training.title, dueDate, daysOverdue),
        })
        overdueEmailsSent++
      } catch (err) {
        logger.error('Cron Reminders', `Overdue email gonderilemedi: ${maskEmail(a.user.email)}`, (err as Error).message)
      }
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
      void sendExpoPushToUser(a.user.id, {
        title: 'Gecikmiş Eğitim',
        body: `"${a.training.title}" ${daysOverdue} gündür gecikmiş`,
        url: `/trainings/${a.training.id}`,
      })
    } catch { /* notification hatası cron'u durdurmasın */ }
  }

  // ── 3. SERTİFİKA YENİLEME HATIRLATMALARI (30, 14, 7, 3 gün kala) ──
  for (const daysLeft of CERT_REMINDER_DAYS) {
    const targetStart = new Date(now + daysLeft * DAY_MS)
    const targetEnd = new Date(now + (daysLeft + 1) * DAY_MS)

    const expiringCerts = await prisma.certificate.findMany({ // perf-check-disable-line
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

      if (emailAllowed(cert.user.organizationId)) {
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
          logger.error('Cron Reminders', `Cert email gonderilemedi: ${maskEmail(cert.user.email)}`, (err as Error).message)
        }
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
        void sendExpoPushToUser(cert.user.id, {
          title: 'Sertifika Yenileme',
          body: `"${cert.training.title}" sertifikan ${daysLeft} gün içinde dolacak`,
          url: `/trainings/${cert.training.id}`,
        })
      } catch { /* notification hatası cron'u durdurmasın */ }
    }
  }

  // ── 4. SERTİFİKA SÜRESİ DOLMUŞ EĞİTİMLERİ YENİDEN ATA (renewalPeriodMonths) ──
  let renewalReassigned = 0
  const expiredCerts = await prisma.certificate.findMany({ // perf-check-disable-line
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

    // Yenileme org'un aktif period'una yapılır; yoksa skip
    if (!cert.user.organizationId) continue
    const renewalPeriod = await findActivePeriod(cert.user.organizationId)
    if (!renewalPeriod) continue

    // Zaten atanmış mı? (aktif period içinde aktif atama var mı)
    // Composite unique artık round içeriyor; en güncel round'u dön.
    const existingAssignment = await prisma.trainingAssignment.findFirst({ // perf-check-disable-line
      where: {
        trainingId: cert.training.id,
        userId: cert.user.id,
        periodId: renewalPeriod.id,
      },
      orderBy: { round: 'desc' },
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
          data: {
            trainingId: cert.training.id,
            userId: cert.user.id,
            organizationId: cert.user.organizationId,
            status: 'assigned',
            periodId: renewalPeriod.id,
          },
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
      void sendExpoPushToUser(cert.user.id, {
        title: 'Sertifika Yenileme Gerekli',
        body: `"${cert.training.title}" sertifikan dolmuş — eğitimi tekrar tamamla`,
        url: `/trainings/${cert.training.id}`,
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

  return NextResponse.json(
    {
      success: true,
      upcomingEmailsSent,
      overdueEmailsSent,
      certEmailsSent,
      notificationsCreated,
      renewalReassigned,
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
