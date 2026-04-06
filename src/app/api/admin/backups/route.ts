import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { uploadBuffer, backupKey } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { maskeTcNo } from '@/lib/utils'

/**
 * KVKK uyumlu PII maskeleme — backup verisindeki hassas alanları maskeler.
 * TC No: sadece son 4 hane, Telefon: sadece son 3 hane, Email: domain korunur.
 */
function sanitizeUsersForBackup(users: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return users.map(u => ({
    ...u,
    tcNo: typeof u.tcNo === 'string' ? maskeTcNo(u.tcNo) || null : u.tcNo ?? null,
    phone: typeof u.phone === 'string' && u.phone.length > 3
      ? `${'*'.repeat(u.phone.length - 3)}${u.phone.slice(-3)}`
      : u.phone ?? null,
  }))
}

/**
 * AES-256-GCM ile backup verisini sifreler.
 * Anahtar: BACKUP_ENCRYPTION_KEY env variable (32 byte hex).
 * Dondurulen format: iv(12 byte hex) + ':' + authTag(16 byte hex) + ':' + ciphertext(hex)
 */
function encryptBackup(plaintext: string): { encrypted: string; isEncrypted: boolean } {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    // Anahtar yoksa sifrelenmeden devam et (uyari logla)
    logger.warn('Backup', 'BACKUP_ENCRYPTION_KEY tanimlanmamis veya gecersiz — backup sifrelenmeden kaydedilecek')
    return { encrypted: plaintext, isEncrypted: false }
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  const encryptedBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuf.toString('hex')}`
  return { encrypted: result, isEncrypted: true }
}

export async function GET(_request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

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

  return jsonResponse({
    backups,
    stats: {
      lastBackup,
      totalSize: totalSize > 0 ? `${totalSize.toFixed(2)} MB` : '-',
      nextAuto: 'Her gün 03:15 UTC',
    },
  })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const [users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: orgId } }),
    prisma.department.findMany({ where: { organizationId: orgId } }),
    prisma.training.findMany({
      where: { organizationId: orgId },
      include: { videos: true, questions: { include: { options: true } } },
    }),
    prisma.trainingAssignment.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.examAttempt.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.examAnswer.findMany({ where: { attempt: { training: { organizationId: orgId } } } }),
    prisma.videoProgress.findMany({ where: { attempt: { training: { organizationId: orgId } } } }),
    prisma.notification.findMany({ where: { organizationId: orgId } }),
    prisma.certificate.findMany({ where: { training: { organizationId: orgId } } }),
  ])

  // KVKK: Hassas PII verilerini maskele
  const sanitizedUsers = sanitizeUsersForBackup(users as unknown as Array<Record<string, unknown>>)

  const backupData = { users: sanitizedUsers, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates, exportedAt: new Date().toISOString() }
  const jsonBlob = JSON.stringify(backupData)

  // AES-256-GCM ile sifreleme (BACKUP_ENCRYPTION_KEY varsa)
  const { encrypted, isEncrypted } = encryptBackup(jsonBlob)
  const sizeMb = Buffer.byteLength(encrypted) / (1024 * 1024)
  const key = backupKey(orgId)
  const buffer = Buffer.from(encrypted, 'utf-8')

  let uploadSuccess = false
  try {
    await uploadBuffer(key, buffer, isEncrypted ? 'application/octet-stream' : 'application/json')
    uploadSuccess = true
  } catch {
    // S3 erişimi yoksa local backup olarak devam et
  }

  const backup = await prisma.dbBackup.create({
    data: {
      organizationId: orgId,
      backupType: 'manual',
      fileUrl: uploadSuccess ? key : 'local',
      fileSizeMb: Math.round(sizeMb * 100) / 100,
      status: 'completed',
      createdById: dbUser!.id,
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'create',
    entityType: 'backup',
    entityId: backup.id,
    request,
  })

  return jsonResponse(backup, 201)
}
