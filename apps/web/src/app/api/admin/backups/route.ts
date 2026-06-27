import path from 'path'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { uploadBuffer, backupKey } from '@/lib/s3'
import { encryptBackup, stringifyBackup } from '@/lib/backup-crypto'
import { buildBackupSnapshot } from '@/lib/backup/snapshot'
import { checkRateLimit } from '@/lib/redis'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/** Yedek boyut uyarı eşiği — bu üzeri admin'e e-posta uyarısı gönderir. */
const BACKUP_SIZE_WARN_MB = 100

/**
 * Cron schedule'ı vercel.json'dan tek seferde okuyup TR-localized human-readable
 * string'e çevirir. Sonuç process lifetime boyunca cache'lenir — vercel.json
 * deploy sırasında değiştiği için runtime'da değişmez.
 */
let nextAutoCache: string | null = null
async function readNextAutoSchedule(): Promise<string> {
  if (nextAutoCache) return nextAutoCache
  try {
    const vercelJsonPath = path.join(process.cwd(), 'vercel.json')
    const raw = await fs.readFile(vercelJsonPath, 'utf-8')
    const conf = JSON.parse(raw) as { crons?: Array<{ path: string; schedule: string }> }
    const cron = conf.crons?.find(c => c.path === '/api/cron/backup')
    if (!cron) {
      nextAutoCache = 'Tanımlı değil'
      return nextAutoCache
    }
    // Cron format: "M H D Mon DOW". Günlük ise "M H * * *".
    const parts = cron.schedule.split(/\s+/)
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      const minute = String(parts[0]).padStart(2, '0')
      const hour = String(parts[1]).padStart(2, '0')
      nextAutoCache = `Her gün ${hour}:${minute} UTC`
    } else {
      nextAutoCache = `Cron: ${cron.schedule}`
    }
    return nextAutoCache
  } catch {
    nextAutoCache = 'Tanımlı değil'
    return nextAutoCache
  }
}

// decryptBackup @/lib/backup-crypto'dan import edilir — download endpoint'i doğrudan
// oradan çeker. Route dosyasından re-export YAPMA: Next.js route dosyaları yalnız
// HTTP handler (GET/POST/...) ve route config export edebilir; başka her export
// `next build` tip kontrolünü kırar ("X is not a valid Route export field").
// Bu hata main CI'ını 22 Mayıs–2 Haziran arası kırmıştı (Vercel Turbopack build'i
// bu kontrolü yapmadığı için production'da fark edilmedi).

export const GET = withAdminRoute(async ({ organizationId }) => {
  const orgId = organizationId

  const rawBackups = await prisma.dbBackup.findMany({
    where: { organizationId: orgId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
  })

  const backups = rawBackups.map(b => ({
    id: b.id,
    type: b.backupType,
    date: new Date(b.createdAt).toLocaleString('tr-TR'),
    size: b.fileSizeMb ? `${Number(b.fileSizeMb)} MB` : '-',
    status: b.status,
  }))

  const lastBackup = rawBackups.length > 0
    ? new Date(rawBackups[0].createdAt).toLocaleString('tr-TR')
    : '-'
  const totalSize = rawBackups.reduce((sum, b) => sum + Number(b.fileSizeMb ?? 0), 0)

  const nextAuto = await readNextAutoSchedule()

  return jsonResponse({
    backups,
    stats: {
      lastBackup,
      totalSize: totalSize > 0 ? `${totalSize.toFixed(2)} MB` : '-',
      nextAuto,
    },
  }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
}, { strict: true, requireOrganization: true })

export const POST = withAdminRoute(async ({ dbUser, organizationId, audit }) => {
  const orgId = organizationId

  // Rate-limit: Manuel yedek S3 maliyetli + cron yarış yaratabilir.
  // Saatte 5 yeterli — admin gerçekten ihtiyaç duyduğunda almak için.
  const allowed = await checkRateLimit(`manual-backup:${dbUser.id}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla manuel yedek isteği. Saatte en fazla 5 yedek alınabilir.', 429)

  // Yedek payload'ı TEK assembler'dan (buildBackupSnapshot) — cron/manuel/download aynı
  // kaynağı kullanır (drift yok). includeAuthUsers: restore'da parola geri-yükleme için
  // auth.users dahil edilir → manuel yedek artık schemaVersion 3 + authUsers içerir
  // (eskiden v2 idi, authUsers'sızdı → bu yedekten restore personeli kilitliyordu).
  // Yedek ham veri içerir; KVKK koruması S3 at-rest encryption + AES-256-GCM + IAM.
  const backupData = await buildBackupSnapshot(orgId, { includeAuthUsers: true })
  const jsonBlob = stringifyBackup(backupData)

  // AES-256-GCM ile sifreleme (BACKUP_ENCRYPTION_KEY varsa)
  const { data: encrypted, isEncrypted } = encryptBackup(jsonBlob)
  const sizeMb = Buffer.byteLength(encrypted) / (1024 * 1024)
  const key = backupKey(orgId)
  const buffer = Buffer.from(encrypted, 'utf-8')

  let uploadSuccess = false
  try {
    await uploadBuffer(key, buffer, isEncrypted ? 'application/octet-stream' : 'application/json')
    uploadSuccess = true
  } catch (err) {
    // S3'e yüklenemediyse yedek HİÇBİR yere kalıcı yazılmadı — 'completed' demek
    // restore edilemez bir yedeği "tamamlandı" göstermek olur (yanıltıcı).
    logger.error('manual-backup', 'S3 yükleme başarısız — yedek failed işaretlendi', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const backup = await prisma.dbBackup.create({
    data: {
      organizationId: orgId,
      backupType: 'manual',
      fileUrl: uploadSuccess ? key : 'local',
      fileSizeMb: Math.round(sizeMb * 100) / 100,
      status: uploadSuccess ? 'completed' : 'failed',
      createdById: dbUser.id,
    },
  })

  await audit({
    action: 'create',
    entityType: 'backup',
    entityId: backup.id,
  })

  // S3'e yazılamadıysa kullanıcıya AÇIK hata dön (UI "başarısız" gösterir); DB satırı
  // 'failed' olarak kalır (görünür kanıt).
  if (!uploadSuccess) {
    return errorResponse('Yedek depolamaya (S3) yüklenemedi — yedek alınamadı. Lütfen S3 erişimini kontrol edin.', 502)
  }

  // Boyut uyarısı: snapshot büyüdükçe S3 maliyeti + restore süresi büyür.
  // 100 MB üzeri admin'e e-posta uyarısı (ADMIN_ALERT_EMAIL tanımlıysa).
  if (sizeMb > BACKUP_SIZE_WARN_MB) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `[Yedekleme Uyarısı] Manuel yedek ${Math.round(sizeMb)} MB`,
        html: `<h3>Büyük Yedek Uyarısı</h3>
          <p>Manuel yedek <strong>${sizeMb.toFixed(2)} MB</strong> boyutuna ulaştı (eşik: ${BACKUP_SIZE_WARN_MB} MB).</p>
          <p><strong>Kurum:</strong> ${orgId}</p>
          <p><strong>Yedek ID:</strong> ${backup.id}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>
          <p>Yedek boyutu büyüdükçe restore süresi ve S3 maliyeti artar. Aksiyon önerileri:</p>
          <ul>
            <li>AuditLog retention'ını 90 günden daha kısa tutmayı düşünün</li>
            <li>Yedek dosyasının nasıl şişdiğini analiz edin (videoProgress / examAnswers genelde en büyük)</li>
            <li>Silinebilir/arşivlenebilir veri var mı inceleyin</li>
          </ul>`,
      }).catch(err => logger.warn('manual-backup', 'Boyut uyari emaili gonderilemedi', (err as Error).message))
    }
  }

  return jsonResponse(backup, 201)
}, { strict: true, requireOrganization: true })
