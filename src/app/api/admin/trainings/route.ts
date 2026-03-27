import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createTrainingBodySchema } from '@/lib/validations'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')

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

  const [trainings, total] = await Promise.all([
    prisma.training.findMany({
      where,
      include: {
        videos: { select: { id: true, title: true, durationSeconds: true, sortOrder: true } },
        _count: { select: { assignments: true, questions: true, videos: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.training.count({ where }),
  ])

  return jsonResponse({ trainings, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

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
          if (!v.url && !v.title) continue;
          await tx.trainingVideo.create({
            data: {
              trainingId: t.id,
              title: v.title || `Video ${idx + 1}`,
              videoUrl: v.url || '',
              videoKey: v.url || `mock-key-${idx}`,
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

    return jsonResponse(training, 201)
  } catch (err: unknown) {
    return errorResponse((err as Error).message || 'Eğitim kaydedilirken bir hata oluştu', 500)
  }
}
