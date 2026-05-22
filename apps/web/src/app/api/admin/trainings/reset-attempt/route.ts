import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { assignmentNextStatus, type AssignmentStatus } from '@/lib/exam-state-machine'

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody<{ assignmentId: string }>(request)
  if (!body?.assignmentId) return errorResponse('assignmentId zorunludur')

  try {
    const assignment = await prisma.trainingAssignment.findFirst({
      where: {
        id: body.assignmentId,
        training: { organizationId: organizationId },
      },
      include: { training: { select: { title: true, maxAttempts: true } }, user: { select: { firstName: true, lastName: true } } },
    })

    if (!assignment) return errorResponse('Atama bulunamadı', 404)

    // State machine ile validate: ATTEMPT_RESET — passed/locked reddedilir (terminal)
    const transition = assignmentNextStatus(assignment.status as AssignmentStatus, { type: 'ATTEMPT_RESET' })
    if (!transition.ok) {
      return errorResponse(transition.reason, 400)
    }

    // Deneme hakkını yenile — `currentAttempt: 0` YAPMA. Eski examAttempt satırları
    // (attemptNumber 1..N) dururken start route `newAttemptNumber = currentAttempt+1`
    // → 1 üretir ve `@@unique([assignmentId, attemptNumber])` ihlal edilir; start
    // transaction'ı 500 döner, personel sınava HİÇ giremez.
    // Çözüm: attempt-requests onayıyla AYNI model — maxAttempts'i artırarak taze
    // bir deneme seti ver. currentAttempt'e ve eski attempt geçmişine dokunulmaz
    // (denetim/raporlama korunur); yeni attemptNumber'lar N+1'den devam eder.
    const freshAttempts = assignment.originalMaxAttempts ?? assignment.maxAttempts ?? 3
    const newMaxAttempts = assignment.currentAttempt + freshAttempts

    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        status: transition.next,
        maxAttempts: newMaxAttempts,
        completedAt: null,
      },
    })

    await audit({
      action: 'reset_attempt',
      entityType: 'training_assignment',
      entityId: assignment.id,
      oldData: {
        status: assignment.status,
        maxAttempts: assignment.maxAttempts,
        currentAttempt: assignment.currentAttempt,
      },
      newData: { status: transition.next, maxAttempts: newMaxAttempts },
    })

    logger.info('Admin Trainings', 'Deneme hakkı yenilendi', {
      assignmentId: assignment.id,
      staff: `${assignment.user.firstName} ${assignment.user.lastName}`,
      training: assignment.training.title,
      newMaxAttempts,
    })

    return jsonResponse({
      success: true,
      message: `${assignment.user.firstName} ${assignment.user.lastName} için yeni deneme hakkı verildi`,
    })
  } catch (err) {
    logger.error('Admin Trainings', 'Deneme hakkı sıfırlama başarısız', err)
    return errorResponse('Deneme hakkı sıfırlanamadı', 500)
  }
}, { requireOrganization: true })
