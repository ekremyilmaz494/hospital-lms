import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/** ZIP magic bytes: PK\x03\x04 */
const ZIP_MAGIC_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04])

/** Maximum file size: 500 MB */
const MAX_FILE_SIZE = 500 * 1024 * 1024

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET!

/**
 * Validate that the file starts with ZIP magic bytes (PK\x03\x04).
 * This prevents non-ZIP files from being uploaded even if they have a .zip extension.
 */
function isValidZip(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, 4))
  return (
    header.length >= 4 &&
    header[0] === ZIP_MAGIC_BYTES[0] &&
    header[1] === ZIP_MAGIC_BYTES[1] &&
    header[2] === ZIP_MAGIC_BYTES[2] &&
    header[3] === ZIP_MAGIC_BYTES[3]
  )
}

/** POST /api/admin/scorm/upload — Upload a SCORM package (.zip) to S3 */
export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) {
    return errorResponse('Organizasyon bulunamadı', 403)
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const trainingId = formData.get('trainingId') as string | null

    if (!file) {
      return errorResponse('Dosya yüklenemedi. Lütfen bir .zip dosyası seçin.', 400)
    }

    if (!file.name.endsWith('.zip')) {
      return errorResponse('Sadece .zip dosyaları kabul edilmektedir.', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('Dosya boyutu 500MB sınırını aşıyor.', 400)
    }

    if (!title || title.trim().length < 3) {
      return errorResponse('Eğitim başlığı en az 3 karakter olmalıdır.', 400)
    }

    // Read file into buffer for magic bytes check and S3 upload
    const arrayBuffer = await file.arrayBuffer()

    if (!isValidZip(arrayBuffer)) {
      return errorResponse('Geçersiz dosya formatı. Dosya gerçek bir ZIP arşivi olmalıdır.', 400)
    }

    const orgId = dbUser!.organizationId!
    const timestamp = Date.now()

    // If updating an existing training, validate it belongs to the org
    let existingTraining = null
    if (trainingId) {
      existingTraining = await prisma.training.findFirst({
        where: {
          id: trainingId,
          organizationId: orgId,
        },
        select: { id: true },
      })

      if (!existingTraining) {
        return errorResponse('Eğitim bulunamadı veya bu organizasyona ait değil.', 404)
      }
    }

    // Generate tenant-isolated S3 key
    const targetTrainingId = trainingId ?? 'new'
    const s3Key = `scorm-packages/${orgId}/${targetTrainingId}/${timestamp}.zip`

    // Upload ZIP to S3
    const fileBuffer = Buffer.from(arrayBuffer)
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/zip',
        ContentDisposition: `attachment; filename="${file.name}"`,
        Metadata: {
          'organization-id': orgId,
          'original-filename': file.name,
          'uploaded-by': dbUser!.id,
        },
      })
    )

    let training

    if (existingTraining) {
      // Update existing training with SCORM path
      training = await prisma.training.update({
        where: { id: existingTraining.id },
        data: {
          scormManifestPath: s3Key,
          title: title.trim(),
          description: `SCORM paketi: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
          category: 'scorm',
        },
      })
    } else {
      // Create new training with SCORM package
      const now = new Date()
      const endDate = new Date(now)
      endDate.setFullYear(endDate.getFullYear() + 1)

      training = await prisma.training.create({
        data: {
          organizationId: orgId,
          title: title.trim(),
          description: `SCORM paketi: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
          category: 'scorm',
          scormManifestPath: s3Key,
          isActive: true,
          startDate: now,
          endDate,
          passingScore: 70,
          maxAttempts: 3,
          examDurationMinutes: 30,
          createdById: dbUser!.id,
        },
      })
    }

    // Update S3 key with the actual training ID if it was a new training
    // so the key path is consistent
    let finalS3Key = s3Key
    if (!trainingId) {
      finalS3Key = `scorm-packages/${orgId}/${training.id}/${timestamp}.zip`

      // Copy to correct path and update DB
      const { CopyObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3')

      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `${BUCKET}/${s3Key}`,
          Key: finalS3Key,
        })
      )

      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
        })
      )

      await prisma.training.update({
        where: { id: training.id },
        data: { scormManifestPath: finalS3Key },
      })
    }

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'scorm_upload',
      entityType: 'training',
      entityId: training.id,
      newData: {
        title: training.title,
        fileName: file.name,
        fileSize: file.size,
        s3Key: finalS3Key,
      },
      request,
    })

    logger.info('SCORM Upload', `SCORM paketi yüklendi: ${training.title}`, {
      trainingId: training.id,
      fileName: file.name,
      s3Key: finalS3Key,
    })

    return jsonResponse(
      {
        id: training.id,
        title: training.title,
        description: training.description,
        category: training.category,
        s3Key: finalS3Key,
        createdAt: training.createdAt.toISOString(),
        updated: !!trainingId,
      },
      trainingId ? 200 : 201
    )
  } catch (err) {
    logger.error('SCORM Upload', 'SCORM paketi yüklenemedi', err)
    return errorResponse('SCORM paketi yüklenemedi', 500)
  }
}
