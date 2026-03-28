import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, certificateExpiryReminderEmail, overdueTrainingReminderEmail } from '@/lib/email'
import { deleteObject } from '@/lib/s3'

/** Daily cleanup cron job (Vercel Cron) */
export async function GET(request: Request) {
  // Verify cron secret — block if undefined
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Delete old read notifications (older than 90 days)
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  })

  // 2. Clean up stale exam attempts (stuck in non-completed state for 24h+)
  const staleAttemptsList = await prisma.examAttempt.findMany({
    where: {
      status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
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

    // Update related TrainingAssignment statuses
    const assignmentIds = [...new Set(staleAttemptsList.map(a => a.assignmentId))]
    await prisma.trainingAssignment.updateMany({
      where: { id: { in: assignmentIds }, status: 'in_progress' },
      data: { status: 'assigned' },
    })
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

  // 6. Delete old backups (older than 90 days) and their S3 objects
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
    timestamp: new Date().toISOString(),
  })
}
