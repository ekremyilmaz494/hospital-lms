import { s3 } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { decryptBackup, stripSensitiveBackupFields, stringifyBackup } from '@/lib/backup-crypto'
import { buildBackupSnapshot } from '@/lib/backup/snapshot'
import { logger } from '@/lib/logger'

export const GET = withSuperAdminRoute<{ id: string }>(async ({ request, params }) => {
  const { id } = params
  const { searchParams } = new URL(request.url)
  const requestedOrgId = searchParams.get('organizationId')?.trim()

  const backup = await prisma.dbBackup.findFirst({
    where: {
      id,
      ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
      status: 'completed',
    },
    include: { organization: { select: { id: true, isDemo: true } } },
  })

  if (!backup?.organizationId || !backup.organization || backup.organization.isDemo) {
    return errorResponse('Yedek bulunamadı', 404)
  }

  const organizationId = backup.organizationId
  const dateStr = new Date(backup.createdAt).toISOString().split('T')[0]
  const headers = {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="yedek-${dateStr}.json"`,
    'Cache-Control': 'private, no-store',
  }

  if (backup.fileUrl !== 'local') {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: backup.fileUrl,
      })
      const s3Response = await s3.send(command)
      const rawBody = await s3Response.Body?.transformToString('utf-8')

      if (rawBody) {
        const decrypted = decryptBackup(rawBody)
        const sanitized = stripSensitiveBackupFields(decrypted)
        return new Response(sanitized, { headers })
      }
    } catch (s3Error) {
      logger.error('Super Admin Backup Download', 'S3 yedek indirme başarısız, DB yedeklemesine geçiliyor', {
        backupId: id,
        fileUrl: backup.fileUrl,
        error: (s3Error as Error).message,
      })
    }
  }

  const backupData = await buildBackupSnapshot(organizationId, {
    exportedAt: backup.createdAt,
    includeAuthUsers: false,
  })

  return new Response(stringifyBackup(backupData), { headers })
})
