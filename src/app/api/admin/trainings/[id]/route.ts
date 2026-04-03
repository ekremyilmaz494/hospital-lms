import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { updateTrainingSchema } from '@/lib/validations'
import { getStreamUrl } from '@/lib/s3'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const training = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    include: {
      videos: { orderBy: { sortOrder: 'asc' } },
      questions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
      assignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, departmentRel: { select: { name: true } } } },
          examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
        },
      },
      _count: { select: { assignments: true, questions: true, videos: true } },
    },
  })

  if (!training) return errorResponse('Training not found', 404)

  // Transform for frontend
  const assignedStaff = training.assignments.map(a => {
    const latestAttempt = a.examAttempts[0] // desc order, take 1
    const progress = (() => {
      const attempt = latestAttempt
      if (!attempt) return 0
      const steps = [
        !!attempt.preExamCompletedAt,
        !!attempt.videosCompletedAt,
        !!attempt.postExamCompletedAt,
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

  const completedCount = training.assignments.filter(a => a.status === 'passed' || a.status === 'failed').length
  const passedCount = training.assignments.filter(a => a.status === 'passed').length
  const failedCount = training.assignments.filter(a => a.status === 'failed').length
  const scores = training.assignments
    .map(a => a.examAttempts[0]?.postExamScore)
    .filter(s => s !== null && s !== undefined)
    .map(Number)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const signedCount = training.assignments.filter(a => a.examAttempts[0]?.signedAt).length

  return jsonResponse({
    id: training.id,
    title: training.title,
    description: training.description,
    category: training.category,
    passingScore: training.passingScore,
    maxAttempts: training.maxAttempts,
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
    videos: await Promise.all(training.videos.map(async v => ({
      id: v.id,
      title: v.title,
      videoUrl: v.videoKey ? await getStreamUrl(v.videoKey) : v.videoUrl,
      duration: `${Math.floor(v.durationSeconds / 60)}:${String(v.durationSeconds % 60).padStart(2, '0')}`,
      order: v.sortOrder,
    }))),
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
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
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

  return jsonResponse(training)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
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

  return jsonResponse({ success: true })
}
