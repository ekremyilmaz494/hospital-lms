import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, getAuthUserWithWriteGuard, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit, invalidateOrgCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { updateTrainingSchema } from '@/lib/validations'
import { getStreamUrl } from '@/lib/s3'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

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

  // S3 URL generation (parallel)
  const streamUrls = await Promise.all(
    training.videos.map(v => (v.videoKey ? getStreamUrl(v.videoKey) : Promise.resolve(null)))
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
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUserWithWriteGuard(request)
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = updateTrainingSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const existing = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Training not found', 404)

  // B5.5 — Güncelleme sırasında bitiş tarihi geçmişte olamaz
  if (parsed.data.endDate && new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)

  const training = await prisma.training.update({ where: { id, organizationId: dbUser!.organizationId! }, data })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'update',
    entityType: 'training',
    entityId: id,
    oldData: existing,
    newData: training,
    request,
  })

  revalidatePath('/staff/my-trainings')
  revalidatePath('/admin/trainings')

  try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}
  try { await invalidateOrgCache(dbUser!.organizationId!, 'trainings') } catch {}

  return jsonResponse(training)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUserWithWriteGuard(request)
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`training-delete:${dbUser!.id}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const existing = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId! } })
  if (!existing) return errorResponse('Training not found', 404)

  // B5.2/G5.2 — Devam eden sınavları kontrol et; ?force=true olmadan engelle
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const activeAttemptCount = await prisma.examAttempt.count({
    where: {
      assignment: { trainingId: id },
      status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
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
    prisma.training.update({ where: { id, organizationId: dbUser!.organizationId! }, data: { isActive: false } }),
    // Devam eden sınav girişimlerini iptal et (force ile onaylandı)
    ...(activeAttemptCount > 0
      ? [prisma.examAttempt.updateMany({
          where: {
            assignment: { trainingId: id },
            status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
          },
          data: { status: 'expired', isPassed: false, postExamCompletedAt: new Date() },
        })]
      : []),
    // Aktif atamaları kilitle (assigned/in_progress → locked)
    prisma.trainingAssignment.updateMany({
      where: { trainingId: id, status: { in: ['assigned', 'in_progress'] } },
      data: { status: 'locked' },
    }),
  ])

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'deactivate',
    entityType: 'training',
    entityId: id,
    oldData: existing,
    request,
  })

  revalidatePath('/staff/my-trainings')
  revalidatePath('/admin/trainings')

  try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}
  try { await invalidateOrgCache(dbUser!.organizationId!, 'trainings') } catch {}

  return jsonResponse({ success: true })
}
