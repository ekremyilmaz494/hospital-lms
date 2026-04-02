import { revalidatePath } from 'next/cache'
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
import { createStandaloneExamSchema } from '@/lib/validations'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { getCached, setCached, invalidateCache } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
    examOnly: true,
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category

  // Redis cache: 5 dk TTL
  const cacheKey = `standalone-exams:${dbUser!.organizationId!}:${page}:${search ?? ''}:${category ?? ''}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached)

  try {
    const [exams, total] = await Promise.all([
      prisma.training.findMany({
        where,
        include: {
          assignments: { select: { status: true } },
          examAttempts: {
            where: { status: 'completed' },
            select: { postExamScore: true, isPassed: true },
          },
          _count: { select: { assignments: true, questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.training.count({ where }),
    ])

    const mapped = exams.map((e) => {
      const completedAttempts = e.examAttempts
      const passedCount = completedAttempts.filter((a) => a.isPassed).length
      const scores = completedAttempts
        .map((a) => a.postExamScore)
        .filter((s) => s !== null)
        .map((s) => Number(s))
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category ?? '',
        passingScore: e.passingScore,
        maxAttempts: e.maxAttempts,
        examDurationMinutes: e.examDurationMinutes,
        startDate: e.startDate?.toISOString() ?? '',
        endDate: e.endDate?.toISOString() ?? '',
        isActive: e.isActive,
        publishStatus: e.publishStatus,
        isCompulsory: e.isCompulsory,
        assignedCount: e._count.assignments,
        questionCount: e._count.questions,
        attemptCount: completedAttempts.length,
        passedCount,
        avgScore,
        createdAt: e.createdAt.toISOString(),
      }
    })

    const responseData = {
      exams: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    await setCached(cacheKey, responseData, 300) // 5 dk TTL
    return jsonResponse(responseData)
  } catch (err) {
    console.error('[standalone-exams GET]', err)
    return errorResponse('Sınavlar yüklenirken hata oluştu', 500)
  }
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const limitError = await checkSubscriptionLimit(
    dbUser!.organizationId!,
    'training',
  )
  if (limitError) return limitError

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createStandaloneExamSchema.safeParse(body)
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

  if (new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  if (new Date(parsed.data.endDate) <= new Date(parsed.data.startDate)) {
    return errorResponse('Bitiş tarihi başlangıç tarihinden sonra olmalı', 400)
  }

  const { questions, selectedDepts, excludedStaff, ...examData } = parsed.data

  try {
    const exam = await prisma.$transaction(
      async (tx) => {
        // 1. Training oluştur (examOnly: true)
        const t = await tx.training.create({
          data: {
            title: examData.title,
            description: examData.description ?? null,
            category: examData.category ?? null,
            passingScore: examData.passingScore,
            maxAttempts: examData.maxAttempts,
            examDurationMinutes: examData.examDurationMinutes,
            startDate: new Date(examData.startDate),
            endDate: new Date(examData.endDate),
            isCompulsory: examData.isCompulsory,
            examOnly: true,
            organizationId: dbUser!.organizationId!,
            createdById: dbUser!.id,
          },
        })

        // 2. Soruları ve şıkları oluştur
        for (const [idx, q] of questions.entries()) {
          const question = await tx.question.create({
            data: {
              trainingId: t.id,
              questionText: q.text,
              points: q.points,
              sortOrder: idx,
            },
          })

          for (const [optIdx, optText] of q.options.entries()) {
            await tx.questionOption.create({
              data: {
                questionId: question.id,
                optionText: optText,
                isCorrect: q.correctOptionIndex === optIdx,
                sortOrder: optIdx,
              },
            })
          }
        }

        // 3. Departman bazlı personel ataması
        if (selectedDepts && selectedDepts.length > 0) {
          const usersToAssign = await tx.user.findMany({
            where: {
              organizationId: dbUser!.organizationId!,
              isActive: true,
              role: 'staff',
              departmentId: { in: selectedDepts },
            },
          })

          const excludedSet = new Set(excludedStaff ?? [])
          const assignments = usersToAssign
            .filter((u) => !excludedSet.has(u.id))
            .map((u) => ({
              trainingId: t.id,
              userId: u.id,
              maxAttempts: examData.maxAttempts,
              assignedById: dbUser!.id,
            }))

          if (assignments.length > 0) {
            await tx.trainingAssignment.createMany({
              data: assignments,
              skipDuplicates: true,
            })
          }
        }

        return t
      },
      { timeout: 30000 },
    )

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: 'standalone_exam.create',
      entityType: 'training',
      entityId: exam.id,
      newData: { title: exam.title, examOnly: true, questionCount: questions.length },
      request,
    })

    revalidatePath('/admin/exams')

    // Cache invalidation — org bazlı key'leri temizle
    try {
      await Promise.all([
        invalidateCache(`standalone-exams:${dbUser!.organizationId!}:1::`),
        invalidateCache(`reports:${dbUser!.organizationId!}:all:all:all`),
        invalidateDashboardCache(dbUser!.organizationId!),
      ])
    } catch {}

    return jsonResponse(exam, 201)
  } catch (err: unknown) {
    return errorResponse(
      (err as Error).message || 'Sınav oluşturulurken bir hata oluştu',
      500,
    )
  }
}
