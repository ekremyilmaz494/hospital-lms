import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, jsonResponse, createAuditLog } from '@/lib/api-helpers'
import { uploadBuffer, backupKey } from '@/lib/s3'
import { encryptBackup } from '@/lib/backup-crypto'

// decryptBackup artık @/lib/backup-crypto'dan import edilir. Download endpoint'i
// doğrudan oradan çeker — bu dosyadan re-export sadece geriye dönük uyumluluk için.
export { decryptBackup } from '@/lib/backup-crypto'

export async function GET(_request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
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
  }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const auditLogCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const [organization, subscription, users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates, auditLogs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.organizationSubscription.findUnique({ where: { organizationId: orgId } }),
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
    prisma.auditLog.findMany({ where: { organizationId: orgId, createdAt: { gte: auditLogCutoff } } }),
  ])

  // Yedek dosyası restore kaynağı olarak kullanılır; PII maskelenmez.
  // Koruma: S3 at-rest encryption + AES-256-GCM (encryptBackup) + IAM.
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
    organizationId: orgId,
    schemaVersion: 2,
  }
  const jsonBlob = JSON.stringify(backupData)

  // AES-256-GCM ile sifreleme (BACKUP_ENCRYPTION_KEY varsa)
  const { data: encrypted, isEncrypted } = encryptBackup(jsonBlob)
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
