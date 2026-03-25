import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { createQuestionSchema } from '@/lib/validations'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const questions = await prisma.question.findMany({
    where: { trainingId: id },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' },
  })

  return jsonResponse(questions)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Verify training belongs to org
  const training = await prisma.training.findFirst({ where: { id, organizationId: dbUser!.organizationId } })
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

  return jsonResponse(question, 201)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Bulk update sort order
  const body = await parseBody<{ questions: { id: string; sortOrder: number }[] }>(request)
  if (!body?.questions) return errorResponse('Invalid body')

  await prisma.$transaction(
    body.questions.map(q =>
      prisma.question.update({ where: { id: q.id }, data: { sortOrder: q.sortOrder } })
    )
  )

  return jsonResponse({ success: true })
}
