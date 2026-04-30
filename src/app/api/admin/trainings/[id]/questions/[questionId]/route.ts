import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createQuestionSchema } from '@/lib/validations'

export const PATCH = withAdminRoute<{ id: string; questionId: string }>(async ({ request, params, organizationId }) => {
  const { id, questionId } = params

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  // Verify training belongs to admin's organization
  const training = await prisma.training.findFirst({ // perf-check-disable-line
    where: { id, organizationId: organizationId },
  })
  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Verify question belongs to this training (prevents cross-tenant P2025 500 errors)
  const existingQuestion = await prisma.question.findFirst({
    where: { id: questionId, trainingId: id },
  })
  if (!existingQuestion) return errorResponse('Soru bulunamadı', 404)

  const parsed = createQuestionSchema.partial().safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { options, ...questionData } = parsed.data

  await prisma.question.update({
    where: { id: questionId, trainingId: id },
    data: questionData,
  })

  if (options) {
    await prisma.questionOption.deleteMany({ where: { questionId } })
    await prisma.questionOption.createMany({
      data: options.map(o => ({ ...o, questionId })),
    })
  }

  const updated = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  })

  return jsonResponse(updated)
}, { requireOrganization: true })

export const DELETE = withAdminRoute<{ id: string; questionId: string }>(async ({ params, organizationId }) => {
  const { id, questionId } = params

  // Verify training belongs to admin's organization
  const training = await prisma.training.findFirst({ // perf-check-disable-line
    where: { id, organizationId: organizationId },
  })
  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  // Verify question belongs to this training (prevents cross-tenant P2025 500 errors)
  const question = await prisma.question.findFirst({
    where: { id: questionId, trainingId: id },
  })
  if (!question) return errorResponse('Soru bulunamadı', 404)

  const deleted = await prisma.question.deleteMany({ where: { id: questionId, trainingId: id } })
  if (deleted.count === 0) return errorResponse('Soru bulunamadi veya yetkiniz yok', 404)

  return jsonResponse({ success: true })
}, { requireOrganization: true })
