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
  safePagination,
} from '@/lib/api-helpers'
import { createStandaloneExamSchema } from '@/lib/validations'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { getCached, setCached, invalidateByPrefix } from '@/lib/redis'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')

  const includeArchived = searchParams.get('includeArchived') === 'true'

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
    examOnly: true,
  }

  if (!includeArchived) {
    where.isActive = true
    where.publishStatus = { not: 'archived' }
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category

  // Redis cache: 5 dk TTL
  const cacheKey = `standalone-exams:${dbUser!.organizationId!}:${page}:${search ?? ''}:${category ?? ''}:${includeArchived ? 'inc' : 'exc'}`
  const cached = await getCached<object>(cacheKey)
  if (cached) return jsonResponse(cached, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })

  try {
    const [exams, total] = await Promise.all([
      prisma.training.findMany({
        where,
        select: {
          id: true, title: true, description: true, category: true,
          passingScore: true, maxAttempts: true, examDurationMinutes: true,
          startDate: true, endDate: true, isActive: true, publishStatus: true,
          isCompulsory: true, createdAt: true,
          _count: { select: { assignments: true, questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.training.count({ where }),
    ])

    // Toplu istatistikler — tüm examAttempt row'larını çekmek yerine groupBy
    const examIds = exams.map(e => e.id)
    const [passedCounts, avgScores, attemptCounts] = examIds.length > 0
      ? await Promise.all([
          prisma.examAttempt.groupBy({
            by: ['trainingId'],
            where: { trainingId: { in: examIds }, isPassed: true, status: 'completed' },
            _count: true,
          }),
          prisma.examAttempt.groupBy({
            by: ['trainingId'],
            where: { trainingId: { in: examIds }, status: 'completed', postExamScore: { not: null } },
            _avg: { postExamScore: true },
          }),
          prisma.examAttempt.groupBy({
            by: ['trainingId'],
            where: { trainingId: { in: examIds }, status: 'completed' },
            _count: true,
          }),
        ])
      : [[], [], []]

    const passedMap = new Map(passedCounts.map(p => [p.trainingId, p._count]))
    const avgMap = new Map(avgScores.map(a => [a.trainingId, Math.round(Number(a._avg.postExamScore ?? 0))]))
    const attemptMap = new Map(attemptCounts.map(a => [a.trainingId, a._count]))

    const mapped = exams.map((e) => ({
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
      attemptCount: attemptMap.get(e.id) ?? 0,
      passedCount: passedMap.get(e.id) ?? 0,
      avgScore: avgMap.get(e.id) ?? 0,
      createdAt: e.createdAt.toISOString(),
    }))

    const responseData = {
      exams: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    await setCached(cacheKey, responseData, 300) // 5 dk TTL
    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('StandaloneExams', 'Sınavlar yüklenirken hata', err)
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
            randomizeQuestions: examData.randomizeQuestions ?? false,
            randomQuestionCount: examData.randomQuestionCount ?? null,
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

    // Cache invalidation — org bazlı tüm sayfaları ve rapor cache'ini temizle
    try {
      await Promise.all([
        invalidateByPrefix(`standalone-exams:${dbUser!.organizationId!}:`),
        invalidateByPrefix(`reports:${dbUser!.organizationId!}:`),
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
