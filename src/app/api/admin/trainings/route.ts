import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createTrainingBodySchema } from '@/lib/validations'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')
  const publishStatus = searchParams.get('publishStatus') // draft | published | archived

  const where: Record<string, unknown> = {
    organizationId: dbUser!.organizationId!,
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'
  if (publishStatus) where.publishStatus = publishStatus

  const [trainings, total] = await Promise.all([
    prisma.training.findMany({
      where,
      include: {
        videos: { select: { id: true, title: true, durationSeconds: true, sortOrder: true } },
        assignments: { select: { status: true } },
        _count: { select: { assignments: true, questions: true, videos: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.training.count({ where }),
  ])

  const mapped = trainings.map(t => {
    const assignedCount = t._count.assignments
    const completedCount = t.assignments.filter(a => a.status === 'passed').length
    const completionRate = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0
    return {
      id: t.id,
      title: t.title,
      category: t.category ?? '',
      assignedCount,
      completedCount,
      completionRate,
      passingScore: t.passingScore,
      publishStatus: t.publishStatus,
      status: t.publishStatus === 'published' ? 'Yayında' : t.publishStatus === 'draft' ? 'Taslak' : 'Arşivlendi',
      startDate: t.startDate?.toISOString() ?? '',
      endDate: t.endDate?.toISOString() ?? '',
      createdBy: '',
    }
  })

  return jsonResponse({ trainings: mapped, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Abonelik limit kontrolu
  const limitError = await checkSubscriptionLimit(dbUser!.organizationId!, 'training')
  if (limitError) return limitError

  const body = await parseBody(request)
  if (!body) return errorResponse('Invalid body')

  const parsed = createTrainingBodySchema.safeParse(body)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message);
      return errorResponse(`Eksik veya hatalı bilgi: ${issues.map((i: { path: string[]; message?: string }) => `${i.path.join('.')}${i.message ? ` (${i.message})` : ''}`).join(', ')}`, 400)
    } catch {
      return errorResponse(parsed.error.message, 400)
    }
  }

  if (new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  const { videos, questions, selectedDepts, excludedStaff, ...trainingData } = parsed.data

  try {
    const training = await prisma.$transaction(async (tx) => {
      // 1. Eğitimi Oluştur
      const t = await tx.training.create({
        data: {
          ...trainingData,
          startDate: new Date(trainingData.startDate),
          endDate: new Date(trainingData.endDate),
          complianceDeadline: trainingData.complianceDeadline ? new Date(trainingData.complianceDeadline) : null,
          organizationId: dbUser!.organizationId!,
          createdById: dbUser!.id,
        },
      })

      // 2. Videoları Oluştur
      if (videos && videos.length > 0) {
        for (const [idx, v] of videos.entries()) {
          if (!v.url) continue;
          const videoTitle = v.title || v.url.split('/').pop()?.replace(/\.[^.]+$/, '') || `Video ${idx + 1}`;
          await tx.trainingVideo.create({
            data: {
              trainingId: t.id,
              title: videoTitle,
              videoUrl: v.url,
              videoKey: v.url,
              durationSeconds: v.durationSeconds || 300,
              sortOrder: idx,
            }
          })
        }
      }

      // 3. Soruları ve Şıkları Oluştur
      if (questions && questions.length > 0) {
        for (const [idx, q] of questions.entries()) {
          const question = await tx.question.create({
            data: {
              trainingId: t.id,
              questionText: q.text,
              points: q.points,
              sortOrder: idx,
            }
          })

          for (const [optIdx, opt] of q.options.entries()) {
            await tx.questionOption.create({
              data: {
                questionId: question.id,
                optionText: opt,
                isCorrect: q.correct === optIdx,
                sortOrder: optIdx,
              }
            })
          }
        }
      }

      // 4. Personel Atamalarını Yap
      if (selectedDepts && selectedDepts.length > 0) {
        const usersToAssign = await tx.user.findMany({
          where: {
            organizationId: dbUser!.organizationId!,
            isActive: true,
            departmentId: { in: selectedDepts },
          }
        })

        const excludedSet = new Set(excludedStaff || [])
        const assignments = usersToAssign
          .filter(u => !excludedSet.has(u.id))
          .map(u => ({
            trainingId: t.id,
            userId: u.id,
            maxAttempts: trainingData.maxAttempts || 3,
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
    }, { timeout: 30000 })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId!,
      action: 'training.create.full',
      entityType: 'training',
      entityId: training.id,
      newData: { title: training.title },
    })

    revalidatePath('/staff/my-trainings')
    revalidatePath('/admin/trainings')

    try { await invalidateDashboardCache(dbUser!.organizationId!) } catch {}

    return jsonResponse(training, 201)
  } catch (err: unknown) {
    return errorResponse((err as Error).message || 'Eğitim kaydedilirken bir hata oluştu', 500)
  }
}
