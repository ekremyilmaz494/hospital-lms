import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  jsonResponse,
  errorResponse,
  parseBody,
  createAuditLog,
  safePagination,
} from '@/lib/api-helpers'
import { createQuestionBankSchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const difficulty = searchParams.get('difficulty')

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
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
  }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

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
      organizationId: dbUser!.organizationId!,
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

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId!,
    action: 'question_bank.create',
    entityType: 'question_bank',
    entityId: question.id,
    newData: { text: question.text, category: question.category },
    request,
  })

  return jsonResponse(question, 201)
}
