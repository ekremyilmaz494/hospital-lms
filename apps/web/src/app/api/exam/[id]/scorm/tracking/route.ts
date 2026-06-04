import { addMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { assignmentNextStatus, ASSIGNMENT_TERMINAL_STATUSES, type AssignmentStatus } from '@/lib/exam-state-machine'
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
    // organizationId filtresi — tenant izolasyonu (Faz 1 ile tutarlı).
    const assignment = await prisma.trainingAssignment.findFirst({
      where: { trainingId, userId: dbUser.id, organizationId },
      orderBy: { assignedAt: 'desc' },
      select: { id: true, status: true },
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

    // D1a — SCORM oturumu başladı = attempt started. assignment 'assigned' ise
    // in_progress'e taşı (dashboard/rapor doğruluğu). State machine üzerinden
    // (updateMany ile bypass YOK); atomik guard yalnız hâlâ 'assigned' iken yazar.
    // Best-effort: başarısız olursa oturum yine geçerli — PATCH passed/completed
    // yolu durumu zaten ileride 'passed'e sürükler.
    if (assignment.status === 'assigned') {
      const startTransition = assignmentNextStatus('assigned', { type: 'ATTEMPT_STARTED' })
      if (startTransition.ok) {
        await prisma.trainingAssignment.updateMany({
          where: { id: assignment.id, status: 'assigned' },
          data: { status: startTransition.next },
        })
      }
    }

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
      // D1a — SCORM tamamlandı/geçti → assignment'ı 'passed' yap. Eskiden SCORM
      // tamamlanması assignment durumunu HİÇ güncellemiyordu (rapor/dashboard'da
      // personel "atandı"da kalıyordu). State machine üzerinden: assigned ise önce
      // in_progress'e (ATTEMPT_STARTED), sonra passed'e (POST_EXAM_PASSED) — bypass YOK.
      // org-filtreli lookup + atomik guard (yalnız non-terminal iken yaz) + audit.
      const assignment = await prisma.trainingAssignment.findFirst({
        where: { trainingId, userId: dbUser.id, organizationId },
        orderBy: { assignedAt: 'desc' },
        select: { id: true, status: true },
      })
      if (assignment && !ASSIGNMENT_TERMINAL_STATUSES.includes(assignment.status as AssignmentStatus)) {
        let interim = assignment.status as AssignmentStatus
        if (interim === 'assigned') {
          const t1 = assignmentNextStatus(interim, { type: 'ATTEMPT_STARTED' })
          if (t1.ok) interim = t1.next
        }
        const t2 = assignmentNextStatus(interim, { type: 'POST_EXAM_PASSED' })
        if (t2.ok) {
          const passedUpdate = await prisma.trainingAssignment.updateMany({
            where: { id: assignment.id, status: { notIn: [...ASSIGNMENT_TERMINAL_STATUSES] } },
            data: { status: t2.next },
          })
          if (passedUpdate.count > 0) {
            await audit({
              action: 'scorm.assignment_passed',
              entityType: 'training_assignment',
              entityId: assignment.id,
              newData: { trainingId, from: assignment.status, to: t2.next },
            })
          }
        }
      }

      const existingCert = await prisma.certificate.findFirst({
        where: {
          trainingId,
          userId: dbUser.id,
        },
      })

      if (!existingCert) {
        // D1b — Sertifika ya ExamAttempt'e (hibrit: SCORM + sınav) YA da bu
        // ScormAttempt'e (saf SCORM) bağlanır. ExamAttempt varsa onu tercih et
        // (mevcut davranış); yoksa scormAttemptId ile bağla — eskiden saf SCORM'da
        // ExamAttempt olmadığı için sertifika HİÇ üretilmiyordu (sessizce atlanıyordu).
        const [examAttempt, training] = await Promise.all([
          prisma.examAttempt.findFirst({
            where: { trainingId, userId: dbUser.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          }),
          prisma.training.findUnique({
            where: { id: trainingId },
            select: { renewalPeriodMonths: true },
          }),
        ])

        const certCode = `SCORM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const expiresAt = training?.renewalPeriodMonths
          ? addMonths(new Date(), training.renewalPeriodMonths)
          : null

        // attempt_id XOR scorm_attempt_id — tam olarak biri set edilir (şema invariant'ı).
        const cert = await prisma.certificate.create({
          data: {
            userId: dbUser.id,
            trainingId,
            organizationId,
            ...(examAttempt ? { attemptId: examAttempt.id } : { scormAttemptId: existing.id }),
            certificateCode: certCode,
            expiresAt,
          },
        })

        await audit({
          action: 'scorm_certificate_created',
          entityType: 'certificate',
          entityId: cert.id,
          newData: { certificateCode: certCode, trainingId, linkedTo: examAttempt ? 'exam_attempt' : 'scorm_attempt' },
        })

        logger.info('SCORM Tracking', 'SCORM sertifikasi olusturuldu', {
          certId: cert.id,
          trainingId,
          linkedTo: examAttempt ? 'exam_attempt' : 'scorm_attempt',
        })
      }
    }

    return jsonResponse(updated)
  } catch (err) {
    logger.error('SCORM Tracking', 'SCORM attempt guncelleme hatasi', err)
    return errorResponse('SCORM verisi güncellenemedi', 500)
  }
}, { requireOrganization: true })
