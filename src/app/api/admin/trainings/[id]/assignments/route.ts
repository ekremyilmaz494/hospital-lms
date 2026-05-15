import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createAssignmentSchema } from '@/lib/validations'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { sendEmail, trainingAssignedEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { getOrCreateActivePeriodForAssignment, findActivePeriod } from '@/lib/training-periods'

export const GET = withAdminRoute<{ id: string }>(async ({ request, params, organizationId }) => {
  const { id } = params

  const { searchParams } = new URL(request.url)

  // Lightweight mode for assignment modal: aktif dönemdeki userId set'i.
  // Modal "zaten atanmış kullanıcıları" disable etmek için kullanır.
  if (searchParams.get('currentPeriodOnly') === '1') {
    const activePeriod = await findActivePeriod(organizationId)
    if (!activePeriod) {
      return jsonResponse({ userIds: [] }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
    }
    const rows = await prisma.trainingAssignment.findMany({
      where: { trainingId: id, periodId: activePeriod.id, training: { organizationId } },
      select: { userId: true },
    })
    return jsonResponse({ userIds: rows.map(r => r.userId) }, 200, { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' })
  }

  // "2. Atama" modal — bitiş tarihine kadar tamamlamayanları 3 segmente böler.
  // Sadece her kullanıcının **en güncel (max round) atamasını** değerlendirir;
  // önceki turlar görmezden gelinir (zaten yeni tur açıldıysa kişiyi tekrar
  // listelemenin anlamı yok).
  if (searchParams.get('incompleteSegments') === '1') {
    const activePeriod = await findActivePeriod(organizationId)
    if (!activePeriod) {
      return jsonResponse(
        { failed: [], noShow: [], overdueInProgress: [] },
        200,
        { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
      )
    }

    const rows = await prisma.trainingAssignment.findMany({
      where: {
        trainingId: id,
        periodId: activePeriod.id,
        organizationId,
        status: { in: ['assigned', 'in_progress', 'failed'] },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        round: true,
        dueDate: true,
        currentAttempt: true,
        maxAttempts: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
        training: { select: { endDate: true } },
        examAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
          select: { postExamScore: true, isPassed: true },
        },
      },
      orderBy: [{ userId: 'asc' }, { round: 'desc' }],
    })

    // Sadece her userId için en güncel round (round desc'ten sonra ilki)
    const seenUsers = new Set<string>()
    const latestPerUser: typeof rows = []
    for (const r of rows) {
      if (seenUsers.has(r.userId)) continue
      seenUsers.add(r.userId)
      latestPerUser.push(r)
    }

    const now = Date.now()
    const failed: Array<{
      assignmentId: string; userId: string; name: string; department: string | null;
      currentAttempt: number; maxAttempts: number; lastScore: number | null; round: number;
    }> = []
    const noShow: Array<{
      assignmentId: string; userId: string; name: string; department: string | null; round: number;
    }> = []
    const overdueInProgress: Array<{
      assignmentId: string; userId: string; name: string; department: string | null;
      currentAttempt: number; round: number;
    }> = []

    for (const a of latestPerUser) {
      const name = `${a.user.firstName} ${a.user.lastName}`.trim()
      const department = a.user.departmentRel?.name ?? null
      const effectiveDue = (a.dueDate ?? a.training.endDate).valueOf()
      const isOverdue = now > effectiveDue

      if (a.status === 'failed') {
        failed.push({
          assignmentId: a.id,
          userId: a.userId,
          name,
          department,
          currentAttempt: a.currentAttempt,
          maxAttempts: a.maxAttempts,
          lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : null,
          round: a.round,
        })
      } else if (a.status === 'assigned' && a.currentAttempt === 0 && isOverdue) {
        noShow.push({ assignmentId: a.id, userId: a.userId, name, department, round: a.round })
      } else if (a.status === 'in_progress' && isOverdue) {
        overdueInProgress.push({
          assignmentId: a.id, userId: a.userId, name, department,
          currentAttempt: a.currentAttempt, round: a.round,
        })
      }
    }

    return jsonResponse(
      { failed, noShow, overdueInProgress },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  }

  const { page, limit, skip } = safePagination(searchParams)

  const where = { trainingId: id, training: { organizationId: organizationId } }

  const [assignments, total] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, departmentRel: { select: { name: true } } } },
        examAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 3,
          select: {
            id: true,
            attemptNumber: true,
            preExamScore: true,
            postExamScore: true,
            isPassed: true,
            postExamCompletedAt: true,
            status: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.trainingAssignment.count({ where }),
  ])

  return jsonResponse({ assignments, total, page, limit }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createAssignmentSchema.safeParse({ ...body as object, trainingId: id })
  if (!parsed.success) return errorResponse(parsed.error.message)

  // Arşivli eğitime yeni atama yapılamaz
  const training = await prisma.training.findFirst({
    where: {
      id,
      organizationId: organizationId,
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

  // PDF içerikler son sınava geçişi tetiklemez — atama öncesi son güvenlik kapısı
  const hasPlayableContent = training.videos.some(v => v.contentType === 'video' || v.contentType === 'audio')
  if (!hasPlayableContent) {
    return errorResponse('Bu eğitim atanamaz: en az bir video veya ses içeriği eklenmelidir.', 400)
  }

  // Aktif dönem zorunlu — atama bu döneme bağlanır.
  // bulk-assign ile aynı pattern: yoksa otomatik aç (aktif period garantisi).
  const targetPeriod = await getOrCreateActivePeriodForAssignment(organizationId)
  if (targetPeriod.status === 'closed') {
    return errorResponse('Kapalı döneme atama yapılamaz', 409)
  }

  // Mevcut atamalar — periodId scope'lu ki önceki dönemde atanmış kullanıcı
  // yeni dönemde tekrar atanabilsin (composite unique [trainingId,userId,periodId]).
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: {
      trainingId: id,
      userId: { in: parsed.data.userIds },
      periodId: targetPeriod.id,
      training: { organizationId: organizationId },
    },
    select: { userId: true },
  })
  const existingUserIds = new Set(existingAssignments.map(a => a.userId))
  const newUserIds = parsed.data.userIds.filter(uid => !existingUserIds.has(uid))

  if (newUserIds.length === 0) return errorResponse('Tüm kullanıcılar zaten atanmış')

  // Org kontrolü: atanacak kullanıcılar admin'in organizasyonuna ait mi?
  const orgUsers = await prisma.user.count({
    where: { id: { in: newUserIds }, organizationId: organizationId },
  })
  if (orgUsers !== newUserIds.length) return errorResponse('Bazı kullanıcılar kurumunuza ait değil', 403)

  const assignments = await prisma.trainingAssignment.createMany({
    data: newUserIds.map(userId => ({
      trainingId: id,
      userId,
      organizationId,
      periodId: targetPeriod.id,
      maxAttempts: parsed.data.maxAttempts,
      originalMaxAttempts: parsed.data.maxAttempts,
      assignedById: dbUser.id,
    })),
  })

  // Create notifications for assigned users
  await prisma.notification.createMany({
    data: newUserIds.map(userId => ({
      userId,
      organizationId: organizationId,
      title: 'Yeni Eğitim Atandı',
      message: `"${training.title}" eğitimi size atandı.`,
      type: 'assignment',
      relatedTrainingId: id,
    })),
  })

  await audit({
    action: 'assign',
    entityType: 'training_assignment',
    entityId: id,
    newData: { userIds: newUserIds, count: assignments.count },
  })

  try { await invalidateDashboardCache(organizationId) } catch {}

  // Fire-and-forget: atanan personellere profesyonel e-posta gönder (tenant SMTP).
  // Atama commit edildikten sonra arka planda çalışır; email hatası response'u etkilemez.
  const orgId = organizationId
  const assignedByName = [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ') || null
  void sendAssignmentEmails({
    organizationId: orgId,
    userIds: newUserIds,
    training: {
      title: training.title,
      description: training.description,
      category: training.category,
      endDate: training.endDate,
      examDurationMinutes: training.examDurationMinutes,
      passingScore: training.passingScore,
      smgPoints: training.smgPoints,
      isCompulsory: training.isCompulsory,
    },
    hospitalName: training.organization.name,
    brandColor: training.organization.brandColor,
    maxAttempts: parsed.data.maxAttempts,
    assignedByName,
  })

  return jsonResponse({ created: assignments.count, skipped: existingUserIds.size }, 201)
}, { requireOrganization: true })

/** Atanan personellere eğitim bildirimi e-postası — arka planda çalışır, hata yutar. */
async function sendAssignmentEmails(params: {
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
  hospitalName: string
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
            organizationName: params.hospitalName,
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
            subject: `${params.hospitalName} · Yeni eğitim atandı: ${params.training.title}`,
            html,
          })
        }),
    )
  } catch (err) {
    logger.error('Assignments', 'Atama e-postaları gönderilemedi', err)
  }
}

/** PATCH — Yönetici: başarısız eğitimi yeniden aç + ek deneme hakkı ver */
export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id: trainingId } = params

  const body = await parseBody<{ userId: string; additionalAttempts?: number }>(request)
  if (!body?.userId) return errorResponse('userId zorunludur')

  const assignment = await prisma.trainingAssignment.findFirst({
    where: { trainingId, userId: body.userId },
    include: { training: { select: { title: true, organizationId: true } } },
  })

  if (!assignment) return errorResponse('Atama bulunamadı', 404)
  if (assignment.training.organizationId !== organizationId) return errorResponse('Yetkisiz erişim', 403)
  if (assignment.status === 'passed') return errorResponse('Bu personel zaten başarılı olmuş')

  const additionalAttempts = Math.min(Math.max(body.additionalAttempts ?? 1, 1), 10)
  const newMaxAttempts = assignment.maxAttempts + additionalAttempts

  await prisma.trainingAssignment.update({
    where: { id: assignment.id },
    data: {
      status: 'assigned',
      maxAttempts: newMaxAttempts,
      completedAt: null,
    },
  })

  await prisma.notification.create({
    data: {
      userId: body.userId,
      organizationId: organizationId,
      title: 'Eğitim Yeniden Açıldı',
      message: `"${assignment.training.title}" eğitimi için ${additionalAttempts} ek deneme hakkı verildi.`,
      type: 'assignment',
      relatedTrainingId: trainingId,
    },
  })

  await audit({
    action: 'reopen_assignment',
    entityType: 'training_assignment',
    entityId: assignment.id,
    newData: { userId: body.userId, additionalAttempts, newMaxAttempts },
  })

  return jsonResponse({ success: true, newMaxAttempts })
}, { requireOrganization: true })
