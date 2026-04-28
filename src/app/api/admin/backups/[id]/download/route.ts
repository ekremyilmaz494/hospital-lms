import { s3 } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { getAuthUserStrict, requireRole, errorResponse } from '@/lib/api-helpers'
import { decryptBackup } from '@/app/api/admin/backups/route'
import { logger } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const backup = await prisma.dbBackup.findFirst({
    where: {
      id,
      organizationId: dbUser!.organizationId!,
      status: 'completed',
    },
  })

  if (!backup) return errorResponse('Yedek bulunamadı', 404)

  const dateStr = new Date(backup.createdAt).toISOString().split('T')[0]
  const headers = {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="yedek-${dateStr}.json"`,
    'Cache-Control': 'private, no-store',
  }

  // S3'te kayıtlı yedek — S3'ten indir + decrypt
  if (backup.fileUrl !== 'local') {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: backup.fileUrl,
      })
      const s3Response = await s3.send(command)
      const rawBody = await s3Response.Body?.transformToString('utf-8')

      if (rawBody) {
        // Şifreli veya düz — decrypt otomatik algılar
        const decrypted = decryptBackup(rawBody)
        return new Response(decrypted, { headers })
      }
    } catch (s3Error) {
      logger.error('Backup Download', 'S3 yedek indirme başarısız, DB yedeklemesine geçiliyor', {
        backupId: id,
        fileUrl: backup.fileUrl,
        error: (s3Error as Error).message,
      })
    }
  }

  // Local yedek veya S3 erişimi başarısız — DB'den yeniden oluştur
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

  const backupData = {
    users, departments, trainings, assignments, attempts,
    examAnswers, videoProgress, notifications, certificates,
    exportedAt: backup.createdAt.toISOString(),
  }

  return new Response(JSON.stringify(backupData, null, 2), { headers })
}
