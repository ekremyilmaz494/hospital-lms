import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/** GET /api/exam/[id]/scorm/tracking — Get latest SCORM attempt */
export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id: trainingId } = params

  try {
    const where: Record<string, unknown> = {
      trainingId,
      userId: dbUser.id,
    }
    // Org izolasyonu: super_admin haric kullanicilar sadece kendi org'larini gorebilir
    if (dbUser.role !== 'super_admin') {
      where.organizationId = organizationId
    }

    const attempt = await prisma.scormAttempt.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse(attempt, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
  } catch (err) {
    logger.error('SCORM Tracking', 'SCORM attempt sorgulama hatasi', err)
    return errorResponse('SCORM verisi alınamadı', 500)
  }
}, { requireOrganization: true })

/** POST /api/exam/[id]/scorm/tracking — Create new SCORM attempt */
export const POST = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id: trainingId } = params

  // Oturum oluşturma seyrek olmalı — abuse/yanlışlıkla tekrar mount koruması.
  const allowed = await checkRateLimit(`scorm-attempt-create:${dbUser.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  try {
    // Verify user has assignment for this training (any period — SCORM legacy)
    const assignment = await prisma.trainingAssignment.findFirst({
      where: { trainingId, userId: dbUser.id },
      orderBy: { assignedAt: 'desc' },
    })

    if (!assignment) {
      return errorResponse('Bu eğitim için atamanız bulunamadı', 403)
    }

    const attempt = await prisma.scormAttempt.create({
      data: {
        organizationId,
        userId: dbUser.id,
        trainingId,
      },
    })

    logger.info('SCORM Tracking', 'Yeni SCORM attempt olusturuldu', {
      attemptId: attempt.attemptId,
      trainingId,
      userId: dbUser.id,
    })

    return jsonResponse(attempt, 201)
  } catch (err) {
    logger.error('SCORM Tracking', 'SCORM attempt olusturma hatasi', err)
    return errorResponse('SCORM oturumu başlatılamadı', 500)
  }
}, { requireOrganization: true })

/** PATCH /api/exam/[id]/scorm/tracking — Update SCORM attempt data */
export const PATCH = withStaffRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id: trainingId } = params

  // SCORM commit'leri sık gelir (istemci ~2sn debounce → ~30/dk); burst için tavan 40/dk.
  const allowed = await checkRateLimit(`scorm-attempt-update:${dbUser.id}`, 40, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const body = await parseBody<{
    suspendData?: string
    lessonStatus?: string
    score?: number
    totalTime?: string
    completionStatus?: string
    successStatus?: string
  }>(request)

  if (!body) {
    return errorResponse('Geçersiz istek verisi', 400)
  }

  try {
    // Find latest attempt (org izolasyonlu)
    const scormWhere: Record<string, unknown> = {
      trainingId,
      userId: dbUser.id,
    }
    if (dbUser.role !== 'super_admin') {
      scormWhere.organizationId = organizationId
    }
    const existing = await prisma.scormAttempt.findFirst({
      where: scormWhere,
      orderBy: { createdAt: 'desc' },
    })

    if (!existing) {
      return errorResponse('SCORM oturumu bulunamadı', 404)
    }

    const updated = await prisma.scormAttempt.update({
      where: { id: existing.id },
      data: {
        suspendData: body.suspendData ?? existing.suspendData,
        lessonStatus: body.lessonStatus ?? existing.lessonStatus,
        score: body.score ?? existing.score,
        totalTime: body.totalTime ?? existing.totalTime,
        completionStatus: body.completionStatus ?? existing.completionStatus,
        successStatus: body.successStatus ?? existing.successStatus,
      },
    })

    // Auto-create certificate if passed or completed
    const status = body.lessonStatus ?? existing.lessonStatus
    if (status === 'passed' || status === 'completed') {
      const existingCert = await prisma.certificate.findFirst({
        where: {
          trainingId,
          userId: dbUser.id,
        },
      })

      if (!existingCert) {
        // We need an ExamAttempt to link the certificate. Find or skip.
        const [examAttempt, training] = await Promise.all([
          prisma.examAttempt.findFirst({
            where: { trainingId, userId: dbUser.id },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.training.findUnique({
            where: { id: trainingId },
            select: { renewalPeriodMonths: true },
          }),
        ])

        if (examAttempt) {
          const certCode = `SCORM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const expiresAt = training?.renewalPeriodMonths
            ? addMonths(new Date(), training.renewalPeriodMonths)
            : null

          const cert = await prisma.certificate.create({
            data: {
              userId: dbUser.id,
              trainingId,
              attemptId: examAttempt.id,
              certificateCode: certCode,
              expiresAt,
            },
          })

          await audit({
            action: 'scorm_certificate_created',
            entityType: 'certificate',
            entityId: cert.id,
            newData: { certificateCode: certCode, trainingId },
          })

          logger.info('SCORM Tracking', 'SCORM sertifikasi olusturuldu', {
            certId: cert.id,
            trainingId,
          })
        }
      }
    }

    return jsonResponse(updated)
  } catch (err) {
    logger.error('SCORM Tracking', 'SCORM attempt guncelleme hatasi', err)
    return errorResponse('SCORM verisi güncellenemedi', 500)
  }
}, { requireOrganization: true })
