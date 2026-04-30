import { prisma } from '@/lib/prisma'
import {
  jsonResponse,
  errorResponse,
  parseBody,
  safePagination,
} from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createQuestionBankSchema } from '@/lib/validations'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const difficulty = searchParams.get('difficulty')

  const where: Record<string, unknown> = {
    organizationId,
  }

  if (search) {
    where.text = { contains: search, mode: 'insensitive' }
  }
  if (category) where.category = category
  if (difficulty) where.difficulty = difficulty

  const [questions, total] = await Promise.all([
    prisma.questionBank.findMany({
      where,
      include: { options: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.questionBank.count({ where }),
  ])

  return jsonResponse({
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      category: q.category,
      difficulty: q.difficulty,
      tags: q.tags,
      points: q.points,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
        order: o.order,
      })),
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createQuestionBankSchema.safeParse(body)
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

  // Tam 1 doğru şık kontrolü
  const correctCount = parsed.data.options.filter((o) => o.isCorrect).length
  if (correctCount !== 1) {
    return errorResponse(
      'Her soruda tam olarak 1 doğru şık olmalıdır',
      400,
    )
  }

  const { options, ...questionData } = parsed.data

  const question = await prisma.questionBank.create({
    data: {
      ...questionData,
      organizationId,
      options: {
        create: options.map((o, idx) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          order: o.order ?? idx,
        })),
      },
    },
    include: { options: { orderBy: { order: 'asc' } } },
  })

  await audit({
    action: 'question_bank.create',
    entityType: 'question_bank',
    entityId: question.id,
    newData: { text: question.text, category: question.category },
  })

  return jsonResponse(question, 201)
}, { requireOrganization: true })
