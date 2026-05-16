import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { reassignAssignmentSchema } from '@/lib/validations'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { sendEmail, trainingAssignedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { getOrCreateActivePeriodForAssignment } from '@/lib/training-periods'

/**
 * POST — Belirtilen tarihe kadar tamamlamayan personeller için aynı eğitime
 * yeni `dueDate` ile **2. tur** (round=N+1) atama oluşturur.
 *
 * Yeni satır: createMany ile bulk insert. Mevcut 1. tur kaydı bozulmaz —
 * `previousAssignmentId` ile zincirlenir (audit). Composite unique
 * (trainingId, userId, periodId, round) sayesinde aynı round 2 kez açılamaz.
 */
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id: trainingId } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

  const parsed = reassignAssignmentSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  const { userIds, newDueDate, reason, additionalAttempts } = parsed.data
  const dueDateObj = new Date(newDueDate)

  if (Number.isNaN(dueDateObj.getTime())) {
    return errorResponse('Geçersiz tarih', 400)
  }
  if (dueDateObj.getTime() <= Date.now()) {
    return errorResponse('Yeni bitiş tarihi gelecekte olmalıdır', 400)
  }

  // 1. Eğitim doğrulama (mevcut assignments POST pattern'i ile aynı)
  const training = await prisma.training.findFirst({
    where: {
      id: trainingId,
      organizationId,
      isActive: true,
      publishStatus: { not: 'archived' },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      endDate: true,
      examDurationMinutes: true,
      passingScore: true,
      smgPoints: true,
      isCompulsory: true,
      videos: { select: { contentType: true } },
      organization: { select: { name: true, brandColor: true } },
    },
  })
  if (!training) return errorResponse('Eğitim bulunamadı veya arşivlenmiş', 404)

  const hasPlayableContent = training.videos.some(v => v.contentType === 'video' || v.contentType === 'audio')
  if (!hasPlayableContent) {
    return errorResponse('Bu eğitim atanamaz: en az bir video veya ses içeriği eklenmelidir.', 400)
  }

  // 2. Aktif period garantisi
  const targetPeriod = await getOrCreateActivePeriodForAssignment(organizationId)
  if (targetPeriod.status === 'closed') {
    return errorResponse('Kapalı döneme atama yapılamaz', 409)
  }

  // 3. Hedef kullanıcıların aktif period'daki **mevcut max round** kayıtlarını çek
  //    (round + status + id). Yeni round bunun üzerine +1 olacak.
  const existingLatestRounds = await prisma.trainingAssignment.findMany({
    where: {
      trainingId,
      userId: { in: userIds },
      periodId: targetPeriod.id,
      organizationId,
    },
    select: { id: true, userId: true, round: true, status: true },
    orderBy: [{ userId: 'asc' }, { round: 'desc' }],
  })

  // userId -> en güncel kayıt (round desc'ten sonra ilki)
  const latestByUser = new Map<string, { id: string; round: number; status: string }>()
  for (const a of existingLatestRounds) {
    if (!latestByUser.has(a.userId)) {
      latestByUser.set(a.userId, { id: a.id, round: a.round, status: a.status })
    }
  }

  // 4. Bütünlük kontrolleri — başarılı veya hiç atanmamış kullanıcıları ayıkla
  const skippedPassed: string[] = []
  const skippedNoAssignment: string[] = []
  const toReassign: Array<{ userId: string; newRound: number; previousAssignmentId: string }> = []

  for (const uid of userIds) {
    const latest = latestByUser.get(uid)
    if (!latest) {
      // Hiç atanmamış kullanıcıya "2. tur" mantıksız — atla
      skippedNoAssignment.push(uid)
      continue
    }
    if (latest.status === 'passed') {
      skippedPassed.push(uid)
      continue
    }
    toReassign.push({
      userId: uid,
      newRound: latest.round + 1,
      previousAssignmentId: latest.id,
    })
  }

  if (toReassign.length === 0) {
    return errorResponse(
      skippedPassed.length > 0
        ? 'Seçili kullanıcılar bu eğitimi zaten başarıyla tamamlamış'
        : 'Seçili kullanıcılar için aktif dönemde mevcut atama bulunamadı',
      409,
    )
  }

  // 5. Org doğrulama (cross-tenant guard)
  const orgUserCount = await prisma.user.count({
    where: { id: { in: toReassign.map(r => r.userId) }, organizationId },
  })
  if (orgUserCount !== toReassign.length) {
    return errorResponse('Bazı kullanıcılar kurumunuza ait değil', 403)
  }

  // 6. createMany — yeni round satırları
  const created = await prisma.trainingAssignment.createMany({
    data: toReassign.map(r => ({
      trainingId,
      userId: r.userId,
      organizationId,
      periodId: targetPeriod.id,
      round: r.newRound,
      dueDate: dueDateObj,
      reassignmentReason: reason,
      previousAssignmentId: r.previousAssignmentId,
      maxAttempts: additionalAttempts,
      originalMaxAttempts: additionalAttempts,
      assignedById: dbUser.id,
      status: 'assigned',
      currentAttempt: 0,
    })),
    skipDuplicates: true,
  })

  // 7. Bildirim (toplu insert)
  await prisma.notification.createMany({
    data: toReassign.map(r => ({
      userId: r.userId,
      organizationId,
      title: 'Eğitim Yeniden Atandı',
      message: `"${training.title}" eğitimi sizin için yeniden açıldı. Yeni bitiş tarihi: ${dueDateObj.toLocaleDateString('tr-TR')}`,
      type: 'assignment',
      relatedTrainingId: trainingId,
    })),
  })

  await audit({
    action: 'reassign_round',
    entityType: 'training_assignment',
    entityId: trainingId,
    newData: {
      count: created.count,
      reason,
      newDueDate: dueDateObj.toISOString(),
      userIds: toReassign.map(r => r.userId),
      skippedPassed,
      skippedNoAssignment,
    },
  })

  try { await invalidateDashboardCache(organizationId) } catch { /* cache hatası response'u etkilemesin */ }

  // 8. Fire-and-forget e-posta
  const assignedByName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || null
  void sendReassignmentEmails({
    organizationId,
    userIds: toReassign.map(r => r.userId),
    training: {
      title: training.title,
      description: training.description,
      category: training.category,
      // Yeni dueDate kullanıcıya bildirilir, training.endDate değil
      endDate: dueDateObj,
      examDurationMinutes: training.examDurationMinutes,
      passingScore: training.passingScore,
      smgPoints: training.smgPoints,
      isCompulsory: training.isCompulsory,
    },
    organizationName: training.organization.name,
    brandColor: training.organization.brandColor,
    maxAttempts: additionalAttempts,
    assignedByName,
  })

  return jsonResponse(
    {
      created: created.count,
      skippedPassed: skippedPassed.length,
      skippedNoAssignment: skippedNoAssignment.length,
      newDueDate: dueDateObj.toISOString(),
    },
    201,
  )
}, { requireOrganization: true })

/** Yeniden atama e-postası — `trainingAssignedEmail` template reuse. */
async function sendReassignmentEmails(params: {
  organizationId: string
  userIds: string[]
  training: {
    title: string
    description: string | null
    category: string | null
    endDate: Date
    examDurationMinutes: number | null
    passingScore: number | null
    smgPoints: number | null
    isCompulsory: boolean
  }
  organizationName: string
  brandColor: string | null
  maxAttempts: number
  assignedByName: string | null
}) {
  try {
    const recipients = await prisma.user.findMany({
      where: { id: { in: params.userIds }, organizationId: params.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })

    const dueDate = params.training.endDate.toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    await Promise.allSettled(
      recipients
        .filter(r => r.email)
        .map(async (r) => {
          const staffName = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email
          const html = trainingAssignedEmail({
            staffName,
            organizationName: params.organizationName,
            brandColor: params.brandColor,
            trainingTitle: params.training.title,
            trainingDescription: params.training.description,
            category: params.training.category,
            endDate: dueDate,
            examDurationMinutes: params.training.examDurationMinutes,
            maxAttempts: params.maxAttempts,
            passingScore: params.training.passingScore,
            smgPoints: params.training.smgPoints,
            isCompulsory: params.training.isCompulsory,
            assignedByName: params.assignedByName,
          })
          await sendEmail({
            organizationId: params.organizationId,
            to: r.email,
            subject: `${params.organizationName} · Eğitim yeniden atandı: ${params.training.title}`,
            html,
          })
        }),
    )
  } catch (err) {
    logger.error('Reassign', 'Yeniden atama e-postaları gönderilemedi', err)
  }
}
