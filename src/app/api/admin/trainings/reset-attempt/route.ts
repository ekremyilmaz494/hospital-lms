import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { assignmentNextStatus, type AssignmentStatus } from '@/lib/exam-state-machine'

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<{ assignmentId: string }>(request)
  if (!body?.assignmentId) return errorResponse('assignmentId zorunludur')

  try {
    const assignment = await prisma.trainingAssignment.findFirst({
      where: {
        id: body.assignmentId,
        training: { organizationId: dbUser!.organizationId! },
      },
      include: { training: { select: { title: true, maxAttempts: true } }, user: { select: { firstName: true, lastName: true } } },
    })

    if (!assignment) return errorResponse('Atama bulunamadı', 404)

    // State machine ile validate: ATTEMPT_RESET — passed/locked reddedilir (terminal)
    const transition = assignmentNextStatus(assignment.status as AssignmentStatus, { type: 'ATTEMPT_RESET' })
    if (!transition.ok) {
      return errorResponse(transition.reason, 400)
    }

    // Deneme hakkını sıfırla — status'u tekrar 'assigned' yap, currentAttempt'i sıfırla
    await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: {
        status: transition.next,
        currentAttempt: 0,
        completedAt: null,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: 'reset_attempt',
      entityType: 'training_assignment',
      entityId: assignment.id,
      oldData: { status: assignment.status, currentAttempt: assignment.currentAttempt },
      newData: { status: 'assigned', currentAttempt: 0 },
      request,
    })

    logger.info('Admin Trainings', 'Deneme hakkı sıfırlandı', {
      assignmentId: assignment.id,
      staff: `${assignment.user.firstName} ${assignment.user.lastName}`,
      training: assignment.training.title,
    })

    return jsonResponse({ success: true, message: `${assignment.user.firstName} ${assignment.user.lastName} için deneme hakkı sıfırlandı` })
  } catch (err) {
    logger.error('Admin Trainings', 'Deneme hakkı sıfırlama başarısız', err)
    return errorResponse('Deneme hakkı sıfırlanamadı', 500)
  }
}
