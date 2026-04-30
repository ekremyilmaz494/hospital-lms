import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { updateTrainingSchema } from '@/lib/validations'
import { getStreamUrl } from '@/lib/s3'
import {
  ATTEMPT_TERMINAL_STATUSES,
  ASSIGNMENT_TERMINAL_STATUSES,
  type AttemptStatus,
  type AssignmentStatus,
} from '@/lib/exam-state-machine'

// State machine ile uyumlu: EXPIRE event'inin toplu (updateMany) hali.
// Terminal olmayan attempt'ler force-delete sırasında expired'a çekilir.
const ATTEMPT_NON_TERMINAL_STATUSES: AttemptStatus[] = (
  ['pre_exam', 'watching_videos', 'post_exam', 'completed', 'expired'] as AttemptStatus[]
).filter(s => !ATTEMPT_TERMINAL_STATUSES.includes(s))

// State machine ile uyumlu: TRAINING_LOCKED event'inin toplu hali.
// Terminal olmayan assignment'lar (assigned/in_progress) force-delete'te locked'a çekilir.
const ASSIGNMENT_NON_TERMINAL_STATUSES: AssignmentStatus[] = (
  ['assigned', 'in_progress', 'passed', 'failed', 'locked'] as AssignmentStatus[]
).filter(s => !ASSIGNMENT_TERMINAL_STATUSES.includes(s))

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params
  const orgId = organizationId

  // Paralel: training + assignment istatistikleri + son 20 atama + imza/skor
  const [training, assignmentStats, recentAssignments, signedCount, avgScoreResult] = await Promise.all([
    prisma.training.findFirst({
      where: { id, organizationId: orgId },
      include: {
        videos: { orderBy: { sortOrder: 'asc' } },
        questions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { assignments: true, questions: true, videos: true } },
      },
    }),
    prisma.trainingAssignment.groupBy({
      by: ['status'],
      where: { trainingId: id },
      _count: true,
    }),
    prisma.trainingAssignment.findMany({
      where: { trainingId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, departmentRel: { select: { name: true } } } },
        examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
      },
      orderBy: { assignedAt: 'desc' },
      take: 20,
    }),
    prisma.examAttempt.count({
      where: { assignment: { trainingId: id }, signedAt: { not: null } },
    }),
    prisma.examAttempt.aggregate({
      where: { assignment: { trainingId: id }, postExamScore: { not: null } },
      _avg: { postExamScore: true },
    }),
  ])

  if (!training) return errorResponse('Training not found', 404)

  // S3 URL generation (parallel) — per-video try/catch: tek bir video sign hatası
  // tüm Promise.all'ı çökertmesin, diğer videolar yine erişilebilir olsun.
  const streamUrls = await Promise.all(
    training.videos.map(async (v) => {
      if (!v.videoKey) return null
      try {
        return await getStreamUrl(v.videoKey)
      } catch (err) {
        console.error('[trainings/[id]] getStreamUrl failed', { videoId: v.id, err })
        return null
      }
    }),
  )

  // Assignment stats from groupBy
  const statusMap = new Map(assignmentStats.map(s => [s.status, s._count]))
  const passedCount = statusMap.get('passed') ?? 0
  const failedCount = statusMap.get('failed') ?? 0
  const completedCount = passedCount + failedCount
  const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0

  // Transform recent assignments for frontend
  const assignedStaff = recentAssignments.map(a => {
    const latestAttempt = a.examAttempts[0]
    const progress = (() => {
      if (!latestAttempt) return 0
      const steps = [
        !!latestAttempt.preExamCompletedAt,
        !!latestAttempt.videosCompletedAt,
        !!latestAttempt.postExamCompletedAt,
      ]
      return Math.round((steps.filter(Boolean).length / 3) * 100)
    })()
    return {
      assignmentId: a.id,
      userId: a.user.id,
      name: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() || a.user.email,
      department: a.user.departmentRel?.name ?? '',
      attempt: a.currentAttempt,
      progress,
      preScore: latestAttempt?.preExamScore ? Number(latestAttempt.preExamScore) : null,
      postScore: latestAttempt?.postExamScore ? Number(latestAttempt.postExamScore) : null,
      status: a.status,
      completedAt: a.completedAt ? a.completedAt.toISOString() : '',
      signedAt: latestAttempt?.signedAt?.toISOString() ?? null,
      signatureMethod: latestAttempt?.signatureMethod ?? null,
    }
  })

  return jsonResponse({
    id: training.id,
    title: training.title,
    description: training.description,
    category: training.category,
    passingScore: training.passingScore,
    maxAttempts: training.maxAttempts,
    feedbackMandatory: training.feedbackMandatory,
    examDurationMinutes: training.examDurationMinutes,
    smgPoints: training.smgPoints,
    startDate: training.startDate,
    endDate: training.endDate,
    isActive: training.isActive,
    publishStatus: training.publishStatus,
    status: training.publishStatus === 'published' ? 'active' : training.publishStatus === 'draft' ? 'draft' : 'archived',
    assignedCount: training._count.assignments,
    completedCount,
    passedCount,
    failedCount,
    avgScore,
    signedCount,
    videoCount: training._count.videos,
    questionCount: training._count.questions,
    assignedStaff,
    videos: training.videos.map((v, i) => ({
      id: v.id,
      title: v.title,
      videoUrl: streamUrls[i] ?? v.videoUrl,
      duration: `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, '0')}`,
      order: v.sortOrder,
      contentType: v.contentType,
    })),
    questions: training.questions.map(q => ({
      id: q.id,
      text: q.questionText,
      points: q.points,
      options: q.options.map(o => ({
        id: o.id,
        text: o.optionText,
        isCorrect: o.isCorrect,
        order: o.sortOrder,
      })),
    })),
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

export const PATCH = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params
  const orgId = organizationId

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = updateTrainingSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.training.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return errorResponse('Training not found', 404)

  // B5.5 — Güncelleme sırasında bitiş tarihi geçmişte olamaz
  if (parsed.data.endDate && new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)

  const training = await prisma.training.update({ where: { id, organizationId: orgId }, data })

  await audit({
    action: 'update',
    entityType: 'training',
    entityId: id,
    oldData: existing,
    newData: training,
  })

  revalidatePath('/staff/my-trainings')
  revalidatePath('/admin/trainings')

  try { await invalidateDashboardCache(orgId) } catch {}
  try { await invalidateOrgCache(orgId, 'trainings') } catch {}

  return jsonResponse(training)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const { id } = params
  const orgId = organizationId

  const allowed = await checkRateLimit(`training-delete:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const existing = await prisma.training.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return errorResponse('Training not found', 404)

  // B5.2/G5.2 — Devam eden sınavları kontrol et; ?force=true olmadan engelle
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const activeAttemptCount = await prisma.examAttempt.count({
    where: {
      assignment: { trainingId: id },
      status: { in: ATTEMPT_NON_TERMINAL_STATUSES },
    },
  })

  if (activeAttemptCount > 0 && !force) {
    return jsonResponse(
      {
        requiresConfirmation: true,
        activeAttemptCount,
        message: `${activeAttemptCount} personelin devam eden sınavı var. Arşivlemek için ?force=true ekleyin.`,
      },
      409,
    )
  }

  // Soft delete: isActive false yap, cascade silme yerine veri korunur
  await prisma.$transaction([
    prisma.training.update({ where: { id, organizationId: orgId }, data: { isActive: false } }),
    // Devam eden sınav girişimlerini iptal et (force ile onaylandı)
    // State machine ile uyumlu: EXPIRE event'inin toplu hali (non-terminal → expired)
    ...(activeAttemptCount > 0
      ? [prisma.examAttempt.updateMany({
          where: {
            assignment: { trainingId: id },
            status: { in: ATTEMPT_NON_TERMINAL_STATUSES },
          },
          data: { status: 'expired', isPassed: false, postExamCompletedAt: new Date() },
        })]
      : []),
    // Aktif atamaları kilitle (assigned/in_progress → locked)
    // State machine ile uyumlu: TRAINING_LOCKED event'inin toplu hali (non-terminal → locked)
    prisma.trainingAssignment.updateMany({
      where: { trainingId: id, status: { in: ASSIGNMENT_NON_TERMINAL_STATUSES } },
      data: { status: 'locked' },
    }),
  ])

  await audit({
    action: 'deactivate',
    entityType: 'training',
    entityId: id,
    oldData: existing,
  })

  revalidatePath('/staff/my-trainings')
  revalidatePath('/admin/trainings')

  try { await invalidateDashboardCache(orgId) } catch {}
  try { await invalidateOrgCache(orgId, 'trainings') } catch {}

  return jsonResponse({ success: true })
}, { requireOrganization: true })
