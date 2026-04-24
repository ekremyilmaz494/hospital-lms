import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, certificateExpiryReminderEmail, overdueTrainingReminderEmail } from '@/lib/email'
import { deleteObject } from '@/lib/s3'
import { ATTEMPT_TERMINAL_STATUSES, type AttemptStatus } from '@/lib/exam-state-machine'

// State machine ile uyumlu: EXPIRE event'inin toplu (updateMany) hali.
// ATTEMPT_TERMINAL_STATUSES sabitinden türetilmiş non-terminal liste — tek tek attemptNextStatus
// çağırmak yerine bulk update için status filtresi olarak kullanılır (perf + atomicity).
const ATTEMPT_NON_TERMINAL_STATUSES: AttemptStatus[] = (
  ['pre_exam', 'watching_videos', 'post_exam', 'completed', 'expired'] as AttemptStatus[]
).filter(s => !ATTEMPT_TERMINAL_STATUSES.includes(s))

/** Daily cleanup cron job (Vercel Cron) */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  // 1. Delete old read notifications (older than 90 days)
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  })

  // 2. Clean up stale exam attempts (stuck in non-completed state for 24h+)
  // State machine ile uyumlu: EXPIRE event'inin toplu hali (terminal olmayan tüm attempt'ler).
  const staleAttemptsList = await prisma.examAttempt.findMany({
    where: {
      status: { in: ATTEMPT_NON_TERMINAL_STATUSES },
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true, assignmentId: true },
  })

  if (staleAttemptsList.length > 0) {
    // Mark attempts as expired with explicit score=0 to avoid null confusion in reports
    await prisma.examAttempt.updateMany({
      where: { id: { in: staleAttemptsList.map(a => a.id) } },
      data: { status: 'expired', isPassed: false, postExamScore: 0, postExamCompletedAt: new Date() },
    })

    // Update related TrainingAssignment statuses — filter out null (standalone exam attempts have no assignment)
    // State machine ile uyumlu: ATTEMPT_RESET event'inin toplu hali (terminal olmayan in_progress → assigned).
    const assignmentIds = [...new Set(
      staleAttemptsList.map(a => a.assignmentId).filter((id): id is string => id !== null)
    )]
    if (assignmentIds.length > 0) {
      // ATTEMPT_RESET event semantiği: sadece 'in_progress' assignment'ı assigned'a döndür.
      // (terminal 'passed'/'failed'/'locked' reset edilmez — state machine bunu da reddeder)
      await prisma.trainingAssignment.updateMany({
        where: { id: { in: assignmentIds }, status: 'in_progress' },
        data: { status: 'assigned' },
      })
    }
  }

  const staleAttempts = { count: staleAttemptsList.length }

  // 3. Delete old audit logs (older than 1 year)
  const deletedLogs = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
  })

  // 4. Sertifika sona erme hatırlatmaları (7 ve 30 gün kala)
  const now30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const expiringCerts = await prisma.certificate.findMany({
    where: {
      expiresAt: { gte: new Date(), lte: now30 },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      training: { select: { title: true } },
    },
  })

  let certRemindersSent = 0
  for (const cert of expiringCerts) {
    if (!cert.expiresAt) continue
    const daysLeft = Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / 86400000)
    // Sadece tam 30 veya 7 gün kalanlar için gönder (günlük cron, tekrar göndermeyi önler)
    if (daysLeft !== 30 && daysLeft !== 7) continue
    try {
      await sendEmail({
        to: cert.user.email,
        subject: `Sertifika Yenileme Hatırlatması: "${cert.training.title}" — ${daysLeft} gün kaldı`,
        html: certificateExpiryReminderEmail(
          `${cert.user.firstName} ${cert.user.lastName}`,
          cert.training.title,
          new Date(cert.expiresAt).toLocaleDateString('tr-TR'),
          daysLeft,
          `${process.env.NEXT_PUBLIC_APP_URL}/staff/my-trainings`,
        ),
      })
      certRemindersSent++
    } catch { /* email hatası cron'u durdurmasın */ }
  }

  // 5. Gecikmiş eğitim hatırlatmaları (ilk gecikme günü)
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status: { in: ['assigned', 'in_progress', 'failed'] },
      training: { endDate: { lt: new Date(), gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      training: { select: { title: true, endDate: true } },
    },
    take: 200,
  })

  let overdueRemindersSent = 0
  for (const a of overdueAssignments) {
    if (!a.training.endDate) continue
    const daysOverdue = Math.floor((Date.now() - new Date(a.training.endDate).getTime()) / 86400000)
    try {
      await sendEmail({
        to: a.user.email,
        subject: `Gecikmiş Eğitim: "${a.training.title}"`,
        html: overdueTrainingReminderEmail(
          `${a.user.firstName} ${a.user.lastName}`,
          a.training.title,
          new Date(a.training.endDate).toLocaleDateString('tr-TR'),
          daysOverdue,
        ),
      })
      overdueRemindersSent++
    } catch { /* email hatası cron'u durdurmasın */ }
  }

  // 6. Sona eren / yakında bitecek abonelikleri kontrol et — admin'e bildirim gönder
  const subWarningDays = [7, 1] // 7 gün ve 1 gün kala uyar
  const subWarningMs = Math.max(...subWarningDays) * 24 * 60 * 60 * 1000
  const expiringSubscriptions = await prisma.organizationSubscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
      expiresAt: { gte: new Date(), lte: new Date(Date.now() + subWarningMs) },
    },
    include: {
      organization: {
        select: {
          name: true,
          users: { where: { role: 'admin', isActive: true }, select: { id: true, email: true, firstName: true, lastName: true }, take: 3 },
        },
      },
    },
  })

  let subscriptionWarningsSent = 0
  for (const sub of expiringSubscriptions) {
    if (!sub.expiresAt) continue
    const daysLeft = Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000)
    if (!subWarningDays.includes(daysLeft)) continue

    // Abonelik bitiş bildirimi — organizasyonun admin kullanıcılarına gönder
    for (const admin of sub.organization.users) {
      try {
        await sendEmail({
          to: admin.email,
          subject: `[${sub.organization.name}] Abonelik ${daysLeft === 1 ? 'Yarın' : `${daysLeft} Gün İçinde`} Sona Eriyor`,
          html: `<p>Sayın ${admin.firstName} ${admin.lastName},</p>
<p><strong>${sub.organization.name}</strong> kurumunuzun aboneliği <strong>${daysLeft} gün</strong> içinde sona erecektir.</p>
<p>Hizmet kesintisi yaşamamak için aboneliğinizi yenilemenizi öneririz.</p>
<p>İletişim: <a href="mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'destek@hastanelms.com'}">${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'destek@hastanelms.com'}</a></p>`,
        })
        subscriptionWarningsSent++

        // Dashboard bildirimi oluştur
        if (admin.id) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              organizationId: sub.organizationId,
              title: 'Abonelik Sona Eriyor',
              message: `Aboneliğiniz ${daysLeft} gün içinde sona erecek. Yenileme için destek ekibiyle iletişime geçin.`,
              type: 'subscription_expiry',
            },
          }).catch(() => {}) // Bildirim hatası cron'u durdurmasın
        }
      } catch { /* email hatası devam ettirir */ }
    }
  }

  // 7. Sınav hatırlatmaları (3 gün ve 1 gün kala)
  let examRemindersSent = 0
  for (const reminderDays of [3, 1]) {
    const targetDate = new Date(Date.now() + reminderDays * 24 * 60 * 60 * 1000)
    const targetStart = new Date(targetDate)
    targetStart.setHours(0, 0, 0, 0)
    const targetEnd = new Date(targetDate)
    targetEnd.setHours(23, 59, 59, 999)

    const pendingExamAssignments = await prisma.trainingAssignment.findMany({
      where: {
        status: 'assigned',
        training: {
          examOnly: true,
          endDate: { gte: targetStart, lte: targetEnd },
          isActive: true,
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        training: { select: { title: true, organizationId: true, endDate: true } },
      },
      take: 500,
    })

    if (pendingExamAssignments.length === 0) continue

    // Bildirimleri toplu oluştur (N+1 → 1 sorgu)
    await prisma.notification.createMany({
      data: pendingExamAssignments.map(a => ({
        userId: a.user.id,
        organizationId: a.training.organizationId,
        title: `Sınav Hatırlatması: ${reminderDays} Gün Kaldı`,
        message: `"${a.training.title}" sınavına ${reminderDays} gün içinde girmelisiniz.`,
        type: 'warning',
        relatedTrainingId: a.trainingId,
      })),
      skipDuplicates: true,
    }).catch(() => {})

    // Emailleri 20'li partiler halinde paralel gönder
    const EMAIL_BATCH = 20
    for (let i = 0; i < pendingExamAssignments.length; i += EMAIL_BATCH) {
      const batch = pendingExamAssignments.slice(i, i + EMAIL_BATCH)
      const results = await Promise.allSettled(batch.map(a =>
        sendEmail({
          to: a.user.email,
          subject: `Sınav Hatırlatması: "${a.training.title}" — ${reminderDays} gün kaldı`,
          html: `<p>Sayın ${a.user.firstName} ${a.user.lastName},</p>
<p><strong>"${a.training.title}"</strong> sınavının bitiş tarihine <strong>${reminderDays} gün</strong> kalmıştır.</p>
<p>Lütfen zamanında sınava girin.</p>
<p>Bitiş tarihi: <strong>${a.training.endDate ? new Date(a.training.endDate).toLocaleDateString('tr-TR') : '-'}</strong></p>`,
        })
      ))
      examRemindersSent += results.filter(r => r.status === 'fulfilled').length
    }
  }

  // 8. Delete old backups (older than 90 days) and their S3 objects
  const oldBackups = await prisma.dbBackup.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    select: { id: true, fileUrl: true },
  })
  for (const b of oldBackups) {
    await deleteObject(b.fileUrl).catch(() => {})
  }
  const deletedBackups = oldBackups.length > 0
    ? await prisma.dbBackup.deleteMany({ where: { id: { in: oldBackups.map(b => b.id) } } })
    : { count: 0 }

  return NextResponse.json({
    success: true,
    deletedNotifications: deletedNotifications.count,
    staleAttemptsClosed: staleAttempts.count,
    deletedLogs: deletedLogs.count,
    deletedBackups: deletedBackups.count,
    certRemindersSent,
    overdueRemindersSent,
    subscriptionWarningsSent,
    examRemindersSent,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
