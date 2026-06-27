import { s3 } from '@/lib/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { decryptBackup, stripSensitiveBackupFields, stringifyBackup } from '@/lib/backup-crypto'
import { buildBackupSnapshot } from '@/lib/backup/snapshot'
import { logger } from '@/lib/logger'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const backup = await prisma.dbBackup.findFirst({
    where: {
      id,
      organizationId,
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
        // GÜVENLİK: auth.users (parola hash'leri + ham metadata) tarayıcıya İNMEZ.
        // Restore S3'i sunucu tarafında okur; indirme yalnız insan-okuması/arşiv içindir.
        const sanitized = stripSensitiveBackupFields(decrypted)
        return new Response(sanitized, { headers })
      }
    } catch (s3Error) {
      logger.error('Backup Download', 'S3 yedek indirme başarısız, DB yedeklemesine geçiliyor', {
        backupId: id,
        fileUrl: backup.fileUrl,
        error: (s3Error as Error).message,
      })
    }
  }

  // Local yedek veya S3 erişimi başarısız — DB'den TEK assembler ile yeniden oluştur.
  // includeAuthUsers: false → indirme dosyasına parola hash'i HİÇ yazılmaz (S3 yolundaki
  // stripSensitiveBackupFields ile aynı koruma; "defense in depth"). Eskiden bu fallback
  // organization/subscription/auditLogs/schemaVersion/organizationId alanlarını atlıyordu
  // (restore'da sessiz veri kaybı) + BigInt video boyutunda JSON.stringify crash veriyordu;
  // buildBackupSnapshot + stringifyBackup ikisini de düzeltir.
  const backupData = await buildBackupSnapshot(organizationId, {
    exportedAt: backup.createdAt,
    includeAuthUsers: false,
  })

  return new Response(stringifyBackup(backupData), { headers })
}, { strict: true, requireOrganization: true })
