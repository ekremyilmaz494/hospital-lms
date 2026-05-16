import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, certificateExpiryReminderEmail, overdueTrainingReminderEmail } from '@/lib/email'
import { BRAND } from '@/lib/brand'
import { deleteObject, downloadBuffer } from '@/lib/s3'
import { decryptBackup } from '@/lib/backup-crypto'
import { logger } from '@/lib/logger'
import { ATTEMPT_TERMINAL_STATUSES, type AttemptStatus, type AssignmentStatus } from '@/lib/exam-state-machine'
import { toEndOfDayUTC } from '@/lib/date-helpers'
import type { UserRole } from '@/types/database'

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

  // 2. Clean up stale exam attempts.
  // ÖNCEKİ TASARIM (problematik): 24 saatten eski tüm non-terminal attempt'leri
  // expire ediyordu. Personel ön sınavı pazartesi yapıp videoları çarşamba bitirmek
  // isterse cron salı 03:00'da attempt'i kapatıyor, kullanıcı geri dönünce eğitim
  // hâlâ açıkken "süresi doldu" görüyordu (RADYASYON 2026-05-16 incident, 8 personel).
  //
  // YENİ TASARIM: Sadece eğitimi gerçekten süresi dolan veya assignment'sız
  // (standalone) attempt'leri expire et. Aktif eğitim deneme süresinde olan
  // kullanıcının yarım kalan attempt'i dokunulmaz.
  //
  // - training.endDate < end-of-day(now) ise expire et (her attempt training'e
  //   bağlı; assignment'lı veya standalone fark etmez — ikisinde de training
  //   relation NOT NULL).
  const nowEod = toEndOfDayUTC(new Date())
  const staleAttemptsList = await prisma.examAttempt.findMany({
    where: {
      status: { in: ATTEMPT_NON_TERMINAL_STATUSES },
      training: { endDate: { lt: nowEod } },
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
        where: { id: { in: assignmentIds }, status: 'in_progress' satisfies AssignmentStatus },
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

  // 3.5 Expo push ticket purge — receipt audit kısa pencere yeter:
  //   - 30 gün eski 'ok' / 'expired' (delivery confirmed, debug penceresi geçti)
  //   - 90 gün eski 'error' (incident root-cause penceresi)
  const deletedExpoTicketsOk = await prisma.expoPushTicket.deleteMany({
    where: {
      status: { in: ['ok', 'expired'] },
      sentAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  })
  const deletedExpoTicketsError = await prisma.expoPushTicket.deleteMany({
    where: {
      status: 'error',
      sentAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
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
  // dueDate (per-atama override) öncelikli; null ise training.endDate fallback.
  const overdueStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const overdueEnd = new Date()
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status: { in: ['assigned', 'in_progress', 'failed'] },
      OR: [
        { dueDate: { lt: overdueEnd, gte: overdueStart } },
        {
          AND: [
            { dueDate: null },
            { training: { endDate: { lt: overdueEnd, gte: overdueStart } } },
          ],
        },
      ],
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      training: { select: { title: true, endDate: true } },
    },
    take: 200,
  })

  let overdueRemindersSent = 0
  for (const a of overdueAssignments) {
    const effective = a.dueDate ?? a.training.endDate
    if (!effective) continue
    const daysOverdue = Math.floor((Date.now() - new Date(effective).getTime()) / 86400000)
    try {
      await sendEmail({
        to: a.user.email,
        subject: `Gecikmiş Eğitim: "${a.training.title}"`,
        html: overdueTrainingReminderEmail(
          `${a.user.firstName} ${a.user.lastName}`,
          a.training.title,
          new Date(effective).toLocaleDateString('tr-TR'),
          daysOverdue,
        ),
      })
      overdueRemindersSent++
    } catch { /* email hatası cron'u durdurmasın */ }

    try {
      await prisma.notification.create({
        data: {
          userId: a.userId,
          organizationId: a.organizationId,
          type: 'reminder',
          title: `Gecikmiş eğitim: ${a.training.title}`,
          message: `"${a.training.title}" eğitiminiz ${daysOverdue} gündür süresini aştı. Lütfen en kısa sürede tamamlayın.`,
          relatedTrainingId: a.trainingId,
        },
      })
    } catch { /* dashboard bildirim hatası cron'u durdurmasın */ }
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
          users: { where: { role: 'admin' satisfies UserRole, isActive: true }, select: { id: true, email: true, firstName: true, lastName: true }, take: 3 },
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
<p>İletişim: <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a></p>`,
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

  // 7.5 Stale draft trainings — 30+ gün dokunulmamış taslakları sil + ilişkili
  // S3 dosyalarını temizle. Aksi halde yarım kalan eğitim taslakları abonelik
  // training limitini şişirir ve orphan video'lar S3'te birikir.
  const staleDrafts = await prisma.training.findMany({
    where: {
      publishStatus: 'draft',
      draftUpdatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, draftData: true },
  })
  let staleDraftS3Deleted = 0
  for (const d of staleDrafts) {
    // Tip-açık iterasyon: draftData free-form JSON, defensively cast
    const dd = d.draftData as { videos?: Array<{ url?: string; documentKey?: string | null }> } | null
    const keys: string[] = []
    if (dd?.videos && Array.isArray(dd.videos)) {
      for (const v of dd.videos) {
        if (v.url) keys.push(v.url)
        if (v.documentKey) keys.push(v.documentKey)
      }
    }
    for (const key of keys) {
      try { await deleteObject(key); staleDraftS3Deleted++ } catch { /* ignore */ }
    }
  }
  const deletedDrafts = staleDrafts.length > 0
    ? await prisma.training.deleteMany({ where: { id: { in: staleDrafts.map(d => d.id) } } })
    : { count: 0 }

  // 8. Delete old backups (older than 90 days) — verify-before-delete politikası.
  //
  // Eski yaklaşım eski yedekleri körü körüne siliyordu. Bu, sessizce bozulan
  // yedek serisinin "silinen sonuncusunun da bozuk olduğunu" gizliyordu. Şimdi:
  //  1) Aynı orgun >90 gün eski yedeği için, daha YENİ ve doğrulanmış (verified=true)
  //     en az 1 yedek olmalı — yoksa silmeyi atla (org'un en az bir geçerli yedeği kalsın).
  //  2) S3'ten download + decrypt + JSON parse round-trip yap; başarılıysa sil.
  //     Round-trip başarısızsa silmeyi atla, admin'e uyarı için failure kaydı bırak.
  //  3) S3 delete hatası logla (sessiz yutma yok).
  const oldBackupCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const oldBackups = await prisma.dbBackup.findMany({
    where: { createdAt: { lt: oldBackupCutoff } },
    select: { id: true, fileUrl: true, organizationId: true, status: true, createdAt: true },
  })

  // Org başına yenisi var mı haritası — tek query ile topla
  const orgIdsWithOld = [...new Set(oldBackups.map(b => b.organizationId).filter((x): x is string => !!x))]
  const recentVerified = orgIdsWithOld.length > 0
    ? await prisma.dbBackup.findMany({
        where: {
          organizationId: { in: orgIdsWithOld },
          createdAt: { gte: oldBackupCutoff },
          status: 'completed',
          verified: true,
        },
        select: { organizationId: true },
      })
    : []
  const orgsWithRecentVerified = new Set(recentVerified.map(r => r.organizationId).filter((x): x is string => !!x))

  const idsToDelete: string[] = []
  const skippedNoRecent: string[] = []
  const skippedVerifyFail: Array<{ id: string; reason: string }> = []
  const deletedKeys: string[] = []

  for (const b of oldBackups) {
    // Org'ta yenisi yoksa eskiyi tutmayı tercih et — hiçbiri kalmasın senaryosunu engelle.
    if (b.organizationId && !orgsWithRecentVerified.has(b.organizationId)) {
      skippedNoRecent.push(b.id)
      continue
    }
    // Local fallback yedekleri için S3'te dosya yok — sadece DB row'unu sil.
    if (b.fileUrl === 'local' || !b.fileUrl) {
      idsToDelete.push(b.id)
      continue
    }

    // S3 round-trip doğrulaması — silmeden önce dosyanın okunabildiğine emin ol.
    let canDelete = false
    let failReason = ''
    try {
      const buf = await downloadBuffer(b.fileUrl)
      if (buf.byteLength === 0) {
        failReason = 'empty_file'
      } else {
        const raw = buf.toString('utf-8')
        const json = decryptBackup(raw)
        // JSON parse — başarılıysa yedek geri yüklenebilir durumda demektir.
        JSON.parse(json)
        canDelete = true
      }
    } catch (err) {
      failReason = err instanceof Error ? err.message.slice(0, 120) : 'unknown'
    }

    if (!canDelete) {
      skippedVerifyFail.push({ id: b.id, reason: failReason })
      // DB'de bozuk olarak işaretle ki monitoring fark etsin
      await prisma.dbBackup.update({
        where: { id: b.id },
        data: { status: 'verification_failed', verified: false },
      }).catch(() => { /* best-effort */ })
      continue
    }

    // Doğrulandı, S3'ten sil
    try {
      await deleteObject(b.fileUrl)
      deletedKeys.push(b.fileUrl)
      idsToDelete.push(b.id)
    } catch (err) {
      logger.error('cleanup', 'S3 delete basarisiz, DB row korundu', { id: b.id, err: err instanceof Error ? err.message : String(err) })
      // S3 silme hatası — DB row'unu silme (drift'i engelle)
    }
  }

  const deletedBackups = idsToDelete.length > 0
    ? await prisma.dbBackup.deleteMany({ where: { id: { in: idsToDelete } } })
    : { count: 0 }

  // Verify-fail olanlar için admin uyarısı
  if (skippedVerifyFail.length > 0) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `[Yedekleme Uyarısı] ${skippedVerifyFail.length} eski yedek doğrulamadan geçemedi`,
        html: `<h3>Cleanup Cron — Verify Before Delete</h3>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p>Aşağıdaki yedekler 90+ gün eski olmasına rağmen okunabilirlik testinden geçemedi.
          DB satırları <code>verification_failed</code> olarak işaretlendi, S3 dosyaları korundu.</p>
          <ul>${skippedVerifyFail.slice(0, 50).map(f => `<li><code>${f.id}</code> — ${f.reason}</li>`).join('')}</ul>
          <p>Lütfen anahtar (BACKUP_ENCRYPTION_KEY) ve S3 erişimini kontrol edin.</p>`,
      }).catch(err => logger.warn('cleanup', 'Verify-fail uyari emaili gonderilemedi', (err as Error).message))
    }
  }

  return NextResponse.json({
    success: true,
    deletedNotifications: deletedNotifications.count,
    staleAttemptsClosed: staleAttempts.count,
    deletedLogs: deletedLogs.count,
    deletedExpoTicketsOk: deletedExpoTicketsOk.count,
    deletedExpoTicketsError: deletedExpoTicketsError.count,
    deletedBackups: deletedBackups.count,
    skippedBackupsNoRecent: skippedNoRecent.length,
    skippedBackupsVerifyFail: skippedVerifyFail.length,
    deletedBackupS3Keys: deletedKeys.length,
    deletedDrafts: deletedDrafts.count,
    staleDraftS3Deleted,
    certRemindersSent,
    overdueRemindersSent,
    subscriptionWarningsSent,
    examRemindersSent,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
