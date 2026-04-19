import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadBuffer } from '@/lib/s3'
import { decryptBackup } from '@/lib/backup-crypto'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/**
 * Haftalık yedek sağlık doğrulaması.
 *
 * Her aktif kurumun son 24 saatteki en yeni `verified=true` yedeğini S3'ten
 * indirir, çözer, JSON'u parse eder ve kurum kimliğini teyit eder. Cron job
 * sırasında deep verification zaten yapılıyor; bu endpoint "yedek cron silinsin
 * ve bozulsun" veya "S3 IAM bozulsun" türü geçikmeli regresyonları yakalar.
 *
 * Schedule: `vercel.json` → Pazar 04:00 UTC.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) throw new Error('CRON_SECRET environment variable is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, isSuspended: false },
    select: { id: true, name: true },
  })

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const problems: string[] = []
  const results: Array<{ orgId: string; ok: boolean; reason?: string }> = []

  for (const org of organizations) {
    try {
      const latest = await prisma.dbBackup.findFirst({
        where: {
          organizationId: org.id,
          backupType: 'auto',
          status: 'completed',
          verified: true,
          createdAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!latest) {
        problems.push(`${org.name} (${org.id}): son 24 saatte doğrulanmış yedek yok`)
        results.push({ orgId: org.id, ok: false, reason: 'no_recent_backup' })
        continue
      }

      if (!latest.fileUrl || latest.fileUrl === 'local') {
        problems.push(`${org.name} (${org.id}): yedek sadece yerel (${latest.id})`)
        results.push({ orgId: org.id, ok: false, reason: 'local_only' })
        continue
      }

      // Round-trip: indir + çöz + parse + kurum kimliği kontrol
      const buf = await downloadBuffer(latest.fileUrl)
      const raw = buf.toString('utf-8')
      const json = decryptBackup(raw)
      const parsed = JSON.parse(json) as { organizationId?: unknown }

      if (parsed.organizationId !== org.id) {
        problems.push(`${org.name} (${org.id}): yedek içindeki organizationId uyuşmuyor`)
        results.push({ orgId: org.id, ok: false, reason: 'org_mismatch' })
        continue
      }

      results.push({ orgId: org.id, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'bilinmeyen'
      problems.push(`${org.name} (${org.id}): doğrulama hatası — ${msg}`)
      results.push({ orgId: org.id, ok: false, reason: msg })
      logger.error('VerifyBackupCron', `${org.name} doğrulama başarısız`, { orgId: org.id, error: msg })
    }
  }

  if (problems.length > 0) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[Yedek Doğrulama] ${problems.length} kurumda sorun tespit edildi`,
        html: `<h3>Haftalık Yedek Doğrulama Raporu</h3>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p><strong>Toplam kurum:</strong> ${organizations.length}</p>
          <p><strong>Sorunlu:</strong> ${problems.length}</p>
          <ul>${problems.map(p => `<li>${p}</li>`).join('')}</ul>
          <p>Öncelikli aksiyon: S3 erişimi + BACKUP_ENCRYPTION_KEY uyumluluğu.</p>`,
      }).catch(err => logger.warn('VerifyBackupCron', 'Uyari emaili gonderilemedi', (err as Error).message))
    }
  }

  return NextResponse.json({
    success: problems.length === 0,
    organizationsChecked: organizations.length,
    problemCount: problems.length,
    results,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
