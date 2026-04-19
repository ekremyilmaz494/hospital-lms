import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadBuffer, backupKey, verifyS3Object, downloadBuffer } from '@/lib/s3'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { encryptBackup, decryptBackup } from '@/lib/backup-crypto'

/**
 * Yedek dosyasını S3'ten indir, çöz, JSON'ı parse et ve içerdeki
 * organizationId'nin beklenenle eştiğini doğrula. Sadece HeadObject/size
 * kontrolü "dosya orada" der ama okunabilirliği kanıtlamaz.
 */
async function deepVerifyBackup(key: string, expectedOrgId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const buf = await downloadBuffer(key)
    if (buf.byteLength === 0) return { ok: false, reason: 'empty_file' }
    const raw = buf.toString('utf-8')
    const json = decryptBackup(raw)
    const parsed = JSON.parse(json) as { organizationId?: unknown }
    if (parsed.organizationId !== expectedOrgId) return { ok: false, reason: 'org_mismatch' }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}

/** Daily auto-backup cron job — runs at 03:15 UTC (after cleanup at 03:00) */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, isSuspended: false },
    select: { id: true, name: true },
  })

  const results: Array<{ orgId: string; status: string; sizeMb?: number }> = []
  const failures: string[] = []

  for (const org of organizations) {
    try {
      // AuditLog geçmişi: son 90 gün. Tamamını dahil etmek backup boyutunu
      // organizasyon başına yüzlerce MB yapabilir; 90 gün regülatif açıdan yeterli.
      const auditLogCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

      const [organization, subscription, users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates, auditLogs] = await Promise.all([
        prisma.organization.findUnique({ where: { id: org.id } }),
        prisma.organizationSubscription.findUnique({ where: { organizationId: org.id } }),
        prisma.user.findMany({ where: { organizationId: org.id } }),
        prisma.department.findMany({ where: { organizationId: org.id } }),
        prisma.training.findMany({
          where: { organizationId: org.id },
          include: { videos: true, questions: { include: { options: true } } },
        }),
        prisma.trainingAssignment.findMany({ where: { training: { organizationId: org.id } } }),
        prisma.examAttempt.findMany({ where: { training: { organizationId: org.id } } }),
        prisma.examAnswer.findMany({ where: { attempt: { training: { organizationId: org.id } } } }),
        prisma.videoProgress.findMany({ where: { attempt: { training: { organizationId: org.id } } } }),
        prisma.notification.findMany({ where: { organizationId: org.id } }),
        prisma.certificate.findMany({ where: { training: { organizationId: org.id } } }),
        prisma.auditLog.findMany({ where: { organizationId: org.id, createdAt: { gte: auditLogCutoff } } }),
      ])

      // Not: Yedek dosyası restore için ham veri içerir. KVKK koruması
      // S3 at-rest şifreleme + AES-256-GCM (encryptBackup) + IAM ile sağlanır.
      // PII maskeleme yapmıyoruz, aksi halde restore telefon numaralarını bozar.
      const backupData = {
        organization,
        subscription,
        users,
        departments,
        trainings,
        assignments,
        attempts,
        examAnswers,
        videoProgress,
        notifications,
        certificates,
        auditLogs,
        exportedAt: new Date().toISOString(),
        organizationId: org.id,
        organizationName: org.name,
        schemaVersion: 2,
      }

      const jsonBlob = JSON.stringify(backupData)

      // AES-256-GCM şifreleme (BACKUP_ENCRYPTION_KEY varsa)
      const { data: finalData, isEncrypted } = encryptBackup(jsonBlob)
      const buffer = Buffer.from(finalData, 'utf-8')
      const sizeMb = buffer.byteLength / (1024 * 1024)
      const key = backupKey(org.id)

      await uploadBuffer(key, buffer, isEncrypted ? 'application/octet-stream' : 'application/json')

      // Deep verification: download + decrypt + parse round-trip.
      // HeadObject (verifyS3Object) başlangıç kontrolü, asıl garanti round-trip'te.
      const headOk = (await verifyS3Object(key)) !== null
      const deep = headOk ? await deepVerifyBackup(key, org.id) : { ok: false, reason: 'head_failed' }
      const isVerified = deep.ok

      await prisma.dbBackup.create({
        data: {
          organizationId: org.id,
          backupType: 'auto',
          fileUrl: key,
          fileSizeMb: Math.round(sizeMb * 100) / 100,
          fileSize: buffer.byteLength,
          verified: isVerified,
          status: isVerified ? 'completed' : 'verification_failed',
          createdById: null,
        },
      })

      results.push({ orgId: org.id, status: isVerified ? 'completed' : 'verification_failed', sizeMb: Math.round(sizeMb * 100) / 100 })

      if (!isVerified) {
        failures.push(`${org.name} (${org.id}): verification_failed (${deep.reason ?? 'unknown'})`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Bilinmeyen hata'
      logger.error('Cron Backup', `Yedekleme başarısız: ${org.name}`, { orgId: org.id, error: errorMsg })
      failures.push(`${org.name} (${org.id}): ${errorMsg}`)

      await prisma.dbBackup.create({
        data: {
          organizationId: org.id,
          backupType: 'auto',
          fileUrl: `backups/${org.id}/${Date.now()}.json`,
          fileSizeMb: 0,
          status: 'failed',
          createdById: null,
        },
      }).catch(() => { /* swallow nested error */ })

      results.push({ orgId: org.id, status: 'failed' })
    }
  }

  // Başarısız yedekler varsa admin'e email gönder
  if (failures.length > 0) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `[Yedekleme Uyarısı] ${failures.length} kurum yedeklemesi başarısız`,
        html: `<h3>Günlük Otomatik Yedekleme Raporu</h3>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Toplam kurum:</strong> ${organizations.length}</p>
          <p><strong>Başarısız:</strong> ${failures.length}</p>
          <ul>${failures.map(f => `<li>${f}</li>`).join('')}</ul>
          <p>Lütfen S3 erişimi ve veritabanı bağlantısını kontrol edin.</p>`,
      }).catch(err => logger.warn('BackupCron', 'Backup uyari emaili gonderilemedi', (err as Error).message))
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    organizationsProcessed: organizations.length,
    failedCount: failures.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
