import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { NextRequest } from 'next/server'

/** GET /api/exam/[id]/scorm/tracking — Get latest SCORM attempt */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainingId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const where: Record<string, unknown> = {
      trainingId,
      userId: dbUser!.id,
    }
    // Org izolasyonu: super_admin haric kullanicilar sadece kendi org'larini gorebilir
    if (dbUser!.role !== 'super_admin' && dbUser!.organizationId) {
      where.organizationId = dbUser!.organizationId
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
}

/** POST /api/exam/[id]/scorm/tracking — Create new SCORM attempt */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainingId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  try {
    // Verify user has assignment for this training
    const assignment = await prisma.trainingAssignment.findUnique({
      where: {
        trainingId_userId: {
          trainingId,
          userId: dbUser!.id,
        },
      },
    })

    if (!assignment) {
      return errorResponse('Bu eğitim için atamanız bulunamadı', 403)
    }

    const attempt = await prisma.scormAttempt.create({
      data: {
        organizationId: dbUser!.organizationId!,
        userId: dbUser!.id,
        trainingId,
      },
    })

    logger.info('SCORM Tracking', 'Yeni SCORM attempt olusturuldu', {
      attemptId: attempt.attemptId,
      trainingId,
      userId: dbUser!.id,
    })

    return jsonResponse(attempt, 201)
  } catch (err) {
    logger.error('SCORM Tracking', 'SCORM attempt olusturma hatasi', err)
    return errorResponse('SCORM oturumu başlatılamadı', 500)
  }
}

/** PATCH /api/exam/[id]/scorm/tracking — Update SCORM attempt data */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trainingId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

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
      userId: dbUser!.id,
    }
    if (dbUser!.role !== 'super_admin' && dbUser!.organizationId) {
      scormWhere.organizationId = dbUser!.organizationId
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
          userId: dbUser!.id,
        },
      })

      if (!existingCert) {
        // We need an ExamAttempt to link the certificate. Find or skip.
        const [examAttempt, training] = await Promise.all([
          prisma.examAttempt.findFirst({
            where: { trainingId, userId: dbUser!.id },
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
              userId: dbUser!.id,
              trainingId,
              attemptId: examAttempt.id,
              certificateCode: certCode,
              expiresAt,
            },
          })

          await createAuditLog({
            userId: dbUser!.id,
            organizationId: dbUser!.organizationId,
            action: 'scorm_certificate_created',
            entityType: 'certificate',
            entityId: cert.id,
            newData: { certificateCode: certCode, trainingId },
            request,
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
}
