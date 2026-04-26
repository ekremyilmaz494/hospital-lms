import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
} from '@/lib/api-helpers'
import { invalidateByPrefix } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { updateStandaloneExamSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const [exam, attemptCount] = await Promise.all([
    prisma.training.findFirst({
      where: { id, organizationId: dbUser!.organizationId!, examOnly: true },
      include: {
        questions: {
          include: { options: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                departmentRel: { select: { name: true } },
              },
            },
            examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 },
          },
        },
        _count: { select: { assignments: true, questions: true } },
      },
    }),
    prisma.examAttempt.count({ where: { trainingId: id } }),
  ])

  if (!exam) return errorResponse('Sınav bulunamadı', 404)

  const assignedStaff = exam.assignments.map((a) => {
    const latestAttempt = a.examAttempts[0]
    return {
      assignmentId: a.id,
      userId: a.user.id,
      name:
        `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() ||
        a.user.email,
      department: a.user.departmentRel?.name ?? '',
      attempt: a.currentAttempt,
      postScore: latestAttempt?.postExamScore
        ? Number(latestAttempt.postExamScore)
        : null,
      status: a.status,
      completedAt: a.completedAt ? a.completedAt.toISOString() : '',
    }
  })

  const passedCount = exam.assignments.filter(
    (a) => a.status === 'passed',
  ).length
  const failedCount = exam.assignments.filter(
    (a) => a.status === 'failed',
  ).length
  const scores = exam.assignments
    .map((a) => a.examAttempts[0]?.postExamScore)
    .filter((s) => s !== null && s !== undefined)
    .map((s) => Number(s))
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

  return jsonResponse({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    category: exam.category,
    passingScore: exam.passingScore,
    maxAttempts: exam.maxAttempts,
    examDurationMinutes: exam.examDurationMinutes,
    startDate: exam.startDate,
    endDate: exam.endDate,
    isActive: exam.isActive,
    publishStatus: exam.publishStatus,
    isCompulsory: exam.isCompulsory,
    randomizeQuestions: exam.randomizeQuestions,
    randomQuestionCount: exam.randomQuestionCount,
    assignedCount: exam._count.assignments,
    attemptCount,
    questionCount: exam._count.questions,
    passedCount,
    failedCount,
    avgScore,
    assignedStaff,
    questions: exam.questions.map((q) => ({
      id: q.id,
      text: q.questionText,
      points: q.points,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.optionText,
        isCorrect: o.isCorrect,
        order: o.sortOrder,
      })),
    })),
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateStandaloneExamSchema.safeParse(body)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message)
      return errorResponse(
        `Eksik veya hatalı bilgi: ${issues.map((i: { path: string[]; message?: string }) => `${i.path.join('.')}${i.message ? ` (${i.message})` : ''}`).join(', ')}`,
        400,
      )
    } catch {
      return errorResponse(parsed.error.message, 400)
    }
  }

  const existing = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId!, examOnly: true },
  })
  if (!existing) return errorResponse('Sınav bulunamadı', 404)

  // Tarih tutarlılığı — bitiş geçmişte olamaz ve başlangıçtan sonra olmalı
  const newStart = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate
  const newEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate
  if (parsed.data.endDate && newEnd < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }
  if (newEnd <= newStart) {
    return errorResponse('Bitiş tarihi başlangıç tarihinden sonra olmalı', 400)
  }

  // Sorular değiştirilecekse: katılımcı varsa reddet (FK orphan koruması)
  if (parsed.data.questions) {
    const attemptCount = await prisma.examAttempt.count({
      where: { trainingId: id },
    })
    if (attemptCount > 0) {
      return errorResponse(
        'Sınava katılım başladığı için sorular değiştirilemez, önce arşivleyin veya yeni bir sınav oluşturun',
        409,
      )
    }
  }

  const { questions, ...scalarData } = parsed.data
  const data: Record<string, unknown> = { ...scalarData }
  if (parsed.data.startDate) data.startDate = newStart
  if (parsed.data.endDate) data.endDate = newEnd

  try {
    const exam = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.training.update({
          where: { id, organizationId: dbUser!.organizationId! },
          data,
        })

        if (questions) {
          await tx.questionOption.deleteMany({
            where: { question: { trainingId: id } },
          })
          await tx.question.deleteMany({ where: { trainingId: id } })

          for (const [idx, q] of questions.entries()) {
            const created = await tx.question.create({
              data: {
                trainingId: id,
                questionText: q.text,
                points: q.points,
                sortOrder: idx,
              },
            })
            await tx.questionOption.createMany({
              data: q.options.map((optText, optIdx) => ({
                questionId: created.id,
                optionText: optText,
                isCorrect: q.correctOptionIndex === optIdx,
                sortOrder: optIdx,
              })),
            })
          }
        }

        return updated
      },
      { timeout: 30000 },
    )

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: 'standalone_exam.update',
      entityType: 'training',
      entityId: id,
      oldData: existing,
      newData: exam,
      request,
    })

    revalidatePath('/admin/exams')
    revalidatePath(`/admin/exams/${id}/edit`)

    try {
      await Promise.all([
        invalidateByPrefix(`standalone-exams:${dbUser!.organizationId!}:`),
        invalidateDashboardCache(dbUser!.organizationId!),
      ])
    } catch {}

    return jsonResponse(exam)
  } catch (err) {
    logger.error('StandaloneExamUpdate', 'Sınav güncellenirken hata', err)
    return errorResponse('Sınav güncellenirken bir hata oluştu', 500)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const existing = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId!, examOnly: true },
  })
  if (!existing) return errorResponse('Sınav bulunamadı', 404)

  // Başlanmış sınav denemesi varsa silme
  const attemptCount = await prisma.examAttempt.count({
    where: { trainingId: id },
  })

  if (attemptCount > 0) {
    return errorResponse(
      'Katılımcısı olan sınav silinemez, önce arşivleyin',
      409,
    )
  }

  // Hiç attempt yoksa cascade sil
  await prisma.$transaction([
    prisma.questionOption.deleteMany({
      where: { question: { trainingId: id } },
    }),
    prisma.question.deleteMany({ where: { trainingId: id } }),
    prisma.trainingAssignment.deleteMany({ where: { trainingId: id } }),
    prisma.training.delete({
      where: { id, organizationId: dbUser!.organizationId! },
    }),
  ])

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'standalone_exam.delete',
    entityType: 'training',
    entityId: id,
    oldData: { title: existing.title },
    request,
  })

  revalidatePath('/admin/exams')

  return jsonResponse({ success: true })
}
