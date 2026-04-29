import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createQuestionSchema } from '@/lib/validations'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  // Verify training belongs to org
  const training = await prisma.training.findFirst({ where: { id, organizationId: organizationId } }) // perf-check-disable-line
  if (!training) return errorResponse('Training not found', 404)

  const questions = await prisma.question.findMany({
    where: { trainingId: id },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse(questions, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })

export const POST = withAdminRoute<{ id: string }>(async ({ request, params, organizationId, audit }) => {
  const { id } = params

  // Verify training belongs to org
  const training = await prisma.training.findFirst({ where: { id, organizationId: organizationId } }) // perf-check-disable-line
  if (!training) return errorResponse('Training not found', 404)

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createQuestionSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { options, ...questionData } = parsed.data

  const question = await prisma.question.create({
    data: {
      ...questionData,
      trainingId: id,
      options: { create: options },
    },
    include: { options: true },
  })

  await audit({
    action: 'create',
    entityType: 'question',
    entityId: question.id,
    newData: { questionText: question.questionText, trainingId: id },
  })

  return jsonResponse(question, 201)
}, { requireOrganization: true })

export const PUT = withAdminRoute<{ id: string }>(async ({ request, params, organizationId }) => {
  const { id } = params

  // Verify training belongs to org
  const training = await prisma.training.findFirst({ where: { id, organizationId: organizationId } }) // perf-check-disable-line
  if (!training) return errorResponse('Training not found', 404)

  // Bulk update sort order
  const body = await parseBody<{ questions: { id: string; sortOrder: number }[] }>(request)
  if (!body?.questions) return errorResponse('Invalid body')

  try {
    await prisma.$transaction(
      body.questions.map(q =>
        prisma.question.update({
          where: { id: q.id },
          data: { sortOrder: q.sortOrder },
        })
      )
    )
  } catch {
    return errorResponse('Sıralama güncellenirken hata oluştu', 500)
  }

  return jsonResponse({ success: true })
}, { requireOrganization: true })
