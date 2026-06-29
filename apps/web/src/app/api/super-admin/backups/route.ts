import path from 'path'
import { promises as fs } from 'fs'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { uploadBuffer, backupKey } from '@/lib/s3'
import { encryptBackup, stringifyBackup } from '@/lib/backup-crypto'
import { buildBackupSnapshot } from '@/lib/backup/snapshot'
import { checkRateLimit } from '@/lib/redis'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

const BACKUP_SIZE_WARN_MB = 100

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

async function getOrganizations() {
  return prisma.organization.findMany({
    where: { isDemo: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  })
}

async function requireRealOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isDemo: false },
    select: { id: true, name: true, code: true },
  })
  if (!organization) return null
  return organization
}

/**
 * GET /api/super-admin/backups
 * Admin panelinde düzeltilen kurum-bazlı yedekleme ekranının super-admin karşılığı.
 * Demo organizasyonlar bilinçli olarak hariçtir.
 */
export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')?.trim() || ''
  const organizations = await getOrganizations()
  const selectedOrganization = organizationId ? await requireRealOrganization(organizationId) : null

  if (organizationId && !selectedOrganization) {
    return errorResponse('Kurum bulunamadı veya demo kurumlar yedek paneline dahil değil', 404)
  }

  const rawBackups = selectedOrganization
    ? await prisma.dbBackup.findMany({
        where: { organizationId: selectedOrganization.id, status: 'completed' },
        orderBy: { createdAt: 'desc' },
      })
    : []

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
    organizations,
    selectedOrganization,
    backups,
    stats: {
      lastBackup,
      totalSize: totalSize > 0 ? `${totalSize.toFixed(2)} MB` : '-',
      nextAuto,
    },
  }, 200, { 'Cache-Control': 'private, no-store' })
})

export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody<{ organizationId?: string }>(request)
  const organizationId = body?.organizationId?.trim()
  if (!organizationId) return errorResponse('Yedek alınacak kurum seçilmelidir', 400)

  const organization = await requireRealOrganization(organizationId)
  if (!organization) return errorResponse('Kurum bulunamadı veya demo kurumlar yedeklenemez', 404)

  const allowed = await checkRateLimit(`manual-backup:super-admin:${dbUser.id}:${organizationId}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla manuel yedek isteği. Saatte en fazla 5 yedek alınabilir.', 429)

  const backupData = await buildBackupSnapshot(organizationId, { includeAuthUsers: true })
  const jsonBlob = stringifyBackup(backupData)
  const { data: encrypted, isEncrypted } = encryptBackup(jsonBlob)
  const sizeMb = Buffer.byteLength(encrypted) / (1024 * 1024)
  const key = backupKey(organizationId)
  const buffer = Buffer.from(encrypted, 'utf-8')

  let uploadSuccess = false
  try {
    await uploadBuffer(key, buffer, isEncrypted ? 'application/octet-stream' : 'application/json')
    uploadSuccess = true
  } catch (err) {
    logger.error('super-admin-manual-backup', 'S3 yükleme başarısız — yedek failed işaretlendi', {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const backup = await prisma.dbBackup.create({
    data: {
      organizationId,
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
    newData: { organizationId, organizationName: organization.name },
  })

  if (!uploadSuccess) {
    return errorResponse('Yedek depolamaya (S3) yüklenemedi — yedek alınamadı. Lütfen S3 erişimini kontrol edin.', 502)
  }

  if (sizeMb > BACKUP_SIZE_WARN_MB) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `[Yedekleme Uyarısı] Manuel yedek ${Math.round(sizeMb)} MB`,
        html: `<h3>Büyük Yedek Uyarısı</h3>
          <p>Manuel yedek <strong>${sizeMb.toFixed(2)} MB</strong> boyutuna ulaştı (eşik: ${BACKUP_SIZE_WARN_MB} MB).</p>
          <p><strong>Kurum:</strong> ${organization.name}</p>
          <p><strong>Yedek ID:</strong> ${backup.id}</p>
          <p><strong>Tarih:</strong> ${new Date().toLocaleString('tr-TR')}</p>`,
      }).catch(err => logger.warn('super-admin-manual-backup', 'Boyut uyarı emaili gönderilemedi', (err as Error).message))
    }
  }

  return jsonResponse(backup, 201)
})
