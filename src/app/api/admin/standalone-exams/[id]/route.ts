import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
} from '@/lib/api-helpers'
import { updateStandaloneExamSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const exam = await prisma.training.findFirst({
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
  })

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
    assignedCount: exam._count.assignments,
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
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = updateStandaloneExamSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message, 400)

  const existing = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId!, examOnly: true },
  })
  if (!existing) return errorResponse('Sınav bulunamadı', 404)

  if (parsed.data.endDate && new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate)
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate)

  const exam = await prisma.training.update({
    where: { id, organizationId: dbUser!.organizationId! },
    data,
  })

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

  return jsonResponse(exam)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
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
