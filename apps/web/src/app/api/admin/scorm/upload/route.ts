import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import {
  downloadBuffer,
  deleteObject,
  getObjectSize,
  isValidScormTmpKeyForOrg,
} from '@/lib/s3'
import { checkFeature } from '@/lib/feature-gate'
import { checkRateLimit } from '@/lib/redis'
import { extractScormPackage, cleanupScormKeys, ScormExtractError } from '@/lib/scorm/extract'
import { ScormManifestError } from '@/lib/scorm/manifest'
import { SCORM_FEATURE_DISABLED_MSG, scormMaxPackageBytes, scormMaxPackageMb } from '@/lib/scorm/config'

// Zip indirme + açma + S3'e yeniden yazma uzun sürebilir (Vercel default 10s yetmez).
export const maxDuration = 300

/**
 * POST /api/admin/scorm/upload — presign ile S3'e yüklenmiş bir SCORM zip'ini
 * işler: indir → aç → imsmanifest.xml parse et → dosyaları kalıcı prefix'e çıkar →
 * Training satırını SCORM alanlarıyla yayınla. Başarısızlıkta her şeyi geri alır.
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const enabled = await checkFeature(organizationId, 'scormSupport')
  if (!enabled) return errorResponse(SCORM_FEATURE_DISABLED_MSG, 403)

  const allowed = await checkRateLimit(`scorm-process:${dbUser.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = (await request.json().catch(() => null)) as { tempKey?: unknown; title?: unknown } | null
  if (!body) return errorResponse('Geçersiz istek verisi', 400)

  const tempKey = typeof body.tempKey === 'string' ? body.tempKey : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!isValidScormTmpKeyForOrg(tempKey, organizationId)) {
    return errorResponse('Geçersiz yükleme anahtarı', 400)
  }
  if (title.length < 3) {
    return errorResponse('Eğitim başlığı en az 3 karakter olmalıdır.', 400)
  }

  // Boyut ön-kontrolü (indirmeden önce) — client presign'da bildirdiğinden büyük yükleyebilir.
  const size = await getObjectSize(tempKey)
  if (size === null) {
    return errorResponse('Yüklenen paket bulunamadı. Lütfen tekrar yükleyin.', 400)
  }
  if (size > scormMaxPackageBytes()) {
    await deleteObject(tempKey)
    return errorResponse(`Paket boyutu ${scormMaxPackageMb()}MB sınırını aşıyor.`, 400)
  }

  const now = new Date()
  const endDate = new Date(now)
  endDate.setFullYear(endDate.getFullYear() + 1)

  // Training'i ÖNCE oluştur (trainingId çıkarma anahtarları için gerekli); taslak/pasif.
  const training = await prisma.training.create({
    data: {
      organizationId,
      title,
      description: 'SCORM eğitimi',
      category: 'scorm',
      isActive: false,
      publishStatus: 'draft',
      startDate: now,
      endDate,
      passingScore: 70,
      maxAttempts: 3,
      examDurationMinutes: 30,
      createdById: dbUser.id,
    },
  })

  let uploadedKeys: string[] = []
  try {
    const buffer = await downloadBuffer(tempKey)
    const result = await extractScormPackage(buffer, { orgId: organizationId, trainingId: training.id })
    uploadedKeys = result.uploadedKeys

    await prisma.training.update({
      where: { id: training.id },
      data: {
        scormManifestPath: result.manifestKey,
        scormEntryPoint: result.manifest.entryHref,
        scormVersion: result.manifest.version,
        ...(result.manifest.masteryScore !== null ? { passingScore: result.manifest.masteryScore } : {}),
        isActive: true,
        publishStatus: 'published',
      },
    })

    await deleteObject(tempKey)

    await audit({
      action: 'scorm_upload',
      entityType: 'training',
      entityId: training.id,
      newData: {
        title,
        scormVersion: result.manifest.version,
        entryPoint: result.manifest.entryHref,
        fileCount: uploadedKeys.length,
      },
    })

    logger.info('SCORM Upload', `SCORM paketi işlendi: ${title}`, {
      trainingId: training.id,
      version: result.manifest.version,
    })

    return jsonResponse(
      {
        id: training.id,
        title,
        scormVersion: result.manifest.version,
        scormEntryPoint: result.manifest.entryHref,
        createdAt: training.createdAt.toISOString(),
      },
      201,
    )
  } catch (err) {
    // Geri al: kısmi çıkarılmış objeler + taslak training + geçici zip.
    await cleanupScormKeys(uploadedKeys)
    await prisma.training.delete({ where: { id: training.id } }).catch(() => {})
    await deleteObject(tempKey)

    if (err instanceof ScormManifestError || err instanceof ScormExtractError) {
      logger.warn('SCORM Upload', 'Geçersiz SCORM paketi', { message: err.message })
      return errorResponse(`Geçersiz SCORM paketi: ${err.message}`, 400)
    }
    logger.error('SCORM Upload', 'SCORM paketi işlenemedi', err)
    return errorResponse('SCORM paketi işlenemedi', 500)
  }
}, { requireOrganization: true })
