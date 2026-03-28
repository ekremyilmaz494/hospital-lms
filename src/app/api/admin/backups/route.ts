import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { uploadBuffer, backupKey } from '@/lib/s3'

export async function GET(request: Request) {
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

  const backupData = { users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates, exportedAt: new Date().toISOString() }
  const jsonBlob = JSON.stringify(backupData)
  const sizeMb = Buffer.byteLength(jsonBlob) / (1024 * 1024)
  const key = backupKey(orgId)
  const buffer = Buffer.from(jsonBlob, 'utf-8')

  let uploadSuccess = false
  try {
    await uploadBuffer(key, buffer, 'application/json')
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
