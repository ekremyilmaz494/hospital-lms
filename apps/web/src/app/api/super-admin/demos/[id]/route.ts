import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase/server'

export const DELETE = withSuperAdminRoute<{ id: string }>(async ({ params, audit }) => {
  const { id } = params

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      isDemo: true,
      users: { select: { id: true, email: true } },
    },
  })

  if (!organization) return errorResponse('Demo bulunamadı', 404)
  if (!organization.isDemo) return errorResponse('Gerçek müşteri organizasyonları bu uçtan silinemez', 403)

  const supabase = await createServiceClient()
  for (const user of organization.users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) return errorResponse(`Auth kullanıcısı silinemedi: ${user.email}`, 502)
  }

  const userIds = organization.users.map((u) => u.id)

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id }, data: { ownerUserId: null } })

    await tx.trainingFeedbackAnswer.deleteMany({ where: { response: { organizationId: id } } })
    await tx.trainingFeedbackResponse.deleteMany({ where: { organizationId: id } })
    await tx.trainingFeedbackItem.deleteMany({ where: { category: { form: { organizationId: id } } } })
    await tx.trainingFeedbackCategory.deleteMany({ where: { form: { organizationId: id } } })
    await tx.trainingFeedbackForm.deleteMany({ where: { organizationId: id } })

    await tx.certificate.deleteMany({ where: { organizationId: id } })
    await tx.examAnswer.deleteMany({ where: { attempt: { organizationId: id } } })
    await tx.videoProgress.deleteMany({ where: { attempt: { organizationId: id } } })
    await tx.examAttemptRequest.deleteMany({ where: { organizationId: id } })
    await tx.examAttempt.deleteMany({ where: { organizationId: id } })
    await tx.scormAttempt.deleteMany({ where: { organizationId: id } })

    await tx.notification.deleteMany({
      where: { OR: [{ organizationId: id }, { userId: { in: userIds } }] },
    })
    await tx.dailyReview.deleteMany({ where: { organizationId: id } })
    await tx.dailySubmission.deleteMany({ where: { organizationId: id } })
    await tx.pointLedger.deleteMany({ where: { organizationId: id } })
    await tx.userStreak.deleteMany({ where: { organizationId: id } })
    await tx.userBadge.deleteMany({ where: { organizationId: id } })

    await tx.competencyAnswer.deleteMany({ where: { evaluation: { form: { organizationId: id } } } })
    await tx.competencyEvaluation.deleteMany({
      where: {
        OR: [
          { form: { organizationId: id } },
          { subjectId: { in: userIds } },
          { evaluatorId: { in: userIds } },
        ],
      },
    })
    await tx.competencyItem.deleteMany({ where: { category: { form: { organizationId: id } } } })
    await tx.competencyCategory.deleteMany({ where: { form: { organizationId: id } } })
    await tx.competencyForm.deleteMany({ where: { organizationId: id } })

    await tx.accreditationReport.deleteMany({ where: { organizationId: id } })
    await tx.accreditationStandard.deleteMany({ where: { organizationId: id } })
    await tx.departmentTrainingRule.deleteMany({ where: { organizationId: id } })
    await tx.trainingAssignment.deleteMany({ where: { organizationId: id } })
    await tx.questionOption.deleteMany({ where: { question: { training: { organizationId: id } } } })
    await tx.question.deleteMany({ where: { training: { organizationId: id } } })
    await tx.trainingVideo.deleteMany({ where: { training: { organizationId: id } } })
    await tx.training.deleteMany({ where: { organizationId: id } })

    await tx.smgTarget.deleteMany({ where: { organizationId: id } })
    await tx.smgActivity.deleteMany({ where: { organizationId: id } })
    await tx.smgPeriod.deleteMany({ where: { organizationId: id } })
    await tx.smgCategory.deleteMany({ where: { organizationId: id } })

    await tx.mediaAsset.deleteMany({ where: { organizationId: id } })
    await tx.questionBankOption.deleteMany({ where: { question: { organizationId: id } } })
    await tx.questionBank.deleteMany({ where: { organizationId: id } })
    await tx.trainingCategory.deleteMany({ where: { organizationId: id } })
    await tx.trainingPeriod.deleteMany({ where: { organizationId: id } })
    await tx.invitation.deleteMany({ where: { organizationId: id } })
    await tx.kvkkRequest.deleteMany({ where: { OR: [{ organizationId: id }, { userId: { in: userIds } }] } })
    await tx.dbBackup.deleteMany({ where: { organizationId: id } })
    await tx.organizationSubscription.deleteMany({ where: { organizationId: id } })
    await tx.department.deleteMany({ where: { organizationId: id } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
    await tx.organization.delete({ where: { id } })
  })

  await audit({
    action: 'demo.delete',
    entityType: 'organization',
    entityId: id,
    oldData: {
      name: organization.name,
      code: organization.code,
      users: organization.users.length,
    },
  })

  return jsonResponse({ success: true })
})
