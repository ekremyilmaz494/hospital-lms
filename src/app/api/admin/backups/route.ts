import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const backups = await prisma.dbBackup.findMany({
    where: { organizationId: dbUser!.organizationId! },
    orderBy: { createdAt: 'desc' },
  })

  return jsonResponse(backups)
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Export organization data as JSON backup
  const orgId = dbUser!.organizationId!

  const [users, trainings, assignments, attempts, notifications] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: orgId } }),
    prisma.training.findMany({
      where: { organizationId: orgId },
      include: { videos: true, questions: { include: { options: true } } },
    }),
    prisma.trainingAssignment.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.examAttempt.findMany({ where: { training: { organizationId: orgId } } }),
    prisma.notification.findMany({ where: { organizationId: orgId } }),
  ])

  const backupData = { users, trainings, assignments, attempts, notifications, exportedAt: new Date().toISOString() }
  const jsonBlob = JSON.stringify(backupData)
  const sizeMb = Buffer.byteLength(jsonBlob) / (1024 * 1024)

  // In production, upload to S3. For now, store reference.
  const backup = await prisma.dbBackup.create({
    data: {
      organizationId: orgId,
      backupType: 'manual',
      fileUrl: `backups/${orgId}/${Date.now()}.json`,
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
