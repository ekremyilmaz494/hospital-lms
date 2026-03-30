import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

/** POST /api/admin/scorm/upload — Upload a SCORM package (.zip) */
export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) {
    return errorResponse('Organizasyon bulunamadi', 403)
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file) {
      return errorResponse('Dosya yuklenemedi. Lutfen bir .zip dosyasi secin.', 400)
    }

    // B5.4 — Hem uzantı hem MIME type doğrula; sadece uzantı kontrolü bypass edilebilir
    const validMimeTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
    ]
    const hasValidExt = file.name.toLowerCase().endsWith('.zip')
    const hasValidMime = validMimeTypes.includes(file.type) || file.type === 'application/octet-stream'
    if (!hasValidExt || !hasValidMime) {
      return errorResponse('Sadece .zip dosyalari kabul edilmektedir.', 400)
    }

    if (!title || title.trim().length < 3) {
      return errorResponse('Egitim basligi en az 3 karakter olmalidir.', 400)
    }

    // File size check (max 500MB)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      return errorResponse('Dosya boyutu 500MB sinirini asiyor.', 400)
    }

    // Placeholder: In production, the zip would be uploaded to S3
    // and unzipped to serve SCORM content. For now, we store file info.
    const zipUrl = `scorm-packages/${dbUser!.organizationId}/${Date.now()}-${file.name}`

    const now = new Date()
    const endDate = new Date(now)
    endDate.setFullYear(endDate.getFullYear() + 1)

    const training = await prisma.training.create({
      data: {
        organizationId: dbUser!.organizationId!,
        title: title.trim(),
        description: `SCORM paketi: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
        category: 'scorm',
        thumbnailUrl: zipUrl,
        isActive: true,
        startDate: now,
        endDate,
        passingScore: 70,
        maxAttempts: 3,
        examDurationMinutes: 30,
        createdById: dbUser!.id,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'scorm_upload',
      entityType: 'training',
      entityId: training.id,
      newData: {
        title: training.title,
        fileName: file.name,
        fileSize: file.size,
        zipUrl,
      },
      request,
    })

    logger.info('SCORM Upload', `SCORM paketi yuklendi: ${training.title}`, {
      trainingId: training.id,
      fileName: file.name,
    })

    return jsonResponse(
      {
        id: training.id,
        title: training.title,
        description: training.description,
        category: training.category,
        zipUrl,
        createdAt: training.createdAt.toISOString(),
      },
      201
    )
  } catch (err) {
    logger.error('SCORM Upload', 'SCORM paketi yuklenemedi', err)
    return errorResponse('SCORM paketi yuklenemedi', 500)
  }
}
