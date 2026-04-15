import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadBuffer, backupKey, verifyS3Object } from '@/lib/s3'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/**
 * KVKK uyumlu PII maskeleme — cron yedeklerde de hassas alanları maskeler.
 */
function sanitizeUsers(users: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return users.map(u => ({
    ...u,
    phone: typeof u.phone === 'string' && u.phone.length > 3
      ? `${'*'.repeat(u.phone.length - 3)}${u.phone.slice(-3)}`
      : u.phone ?? null,
  }))
}

/**
 * AES-256-GCM şifreleme — manuel backup ile aynı format.
 */
function encryptIfKeyExists(plaintext: string): { data: string; isEncrypted: boolean } {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length !== 64) return { data: plaintext, isEncrypted: false }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  const encryptedBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { data: `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuf.toString('hex')}`, isEncrypted: true }
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
      const [users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates] = await Promise.all([
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
      ])

      // KVKK: PII maskeleme — cron yedekler de güvenli
      const sanitizedUsers = sanitizeUsers(users as unknown as Array<Record<string, unknown>>)

      const backupData = {
        users: sanitizedUsers,
        departments,
        trainings,
        assignments,
        attempts,
        examAnswers,
        videoProgress,
        notifications,
        certificates,
        exportedAt: new Date().toISOString(),
        organizationId: org.id,
        organizationName: org.name,
      }

      const jsonBlob = JSON.stringify(backupData)

      // AES-256-GCM şifreleme (BACKUP_ENCRYPTION_KEY varsa)
      const { data: finalData, isEncrypted } = encryptIfKeyExists(jsonBlob)
      const buffer = Buffer.from(finalData, 'utf-8')
      const sizeMb = buffer.byteLength / (1024 * 1024)
      const key = backupKey(org.id)

      await uploadBuffer(key, buffer, isEncrypted ? 'application/octet-stream' : 'application/json')

      // Verify the uploaded backup
      const verifiedSize = await verifyS3Object(key)
      const isVerified = verifiedSize !== null && verifiedSize > 0

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
        failures.push(`${org.name} (${org.id}): verification_failed`)
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
