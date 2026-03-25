import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination } from '@/lib/api-helpers'
import { createTrainingSchema } from '@/lib/validations'

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
    organizationId: dbUser!.organizationId,
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
      skip: (page - 1) * limit,
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

  const parsed = createTrainingSchema.safeParse(body)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message);
      return errorResponse(`Eksik veya hatalı bilgi: ${issues.map((i: { path: string[] }) => i.path.join('.')).join(', ')}`, 400)
    } catch {
      return errorResponse(parsed.error.message, 400)
    }
  }

  try {
    const training = await prisma.$transaction(async (tx) => {
      // 1. Eğitimi Oluştur
      const t = await tx.training.create({
        data: {
          ...parsed.data,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          organizationId: dbUser!.organizationId!,
          createdById: dbUser!.id,
        },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reqBody = body as any;

      // 2. Videoları Oluştur
      if (reqBody.videos && Array.isArray(reqBody.videos)) {
        for (const [idx, v] of reqBody.videos.entries()) {
          if (!v.url && !v.title) continue;
          await tx.trainingVideo.create({
            data: {
              trainingId: t.id,
              title: v.title || `Video ${idx + 1}`,
              videoUrl: v.url || '',
              videoKey: v.url || `mock-key-${idx}`,
              durationSeconds: 300, // Varsayılan süre, normalde videodan hesaplanır
              sortOrder: idx,
            }
          })
        }
      }

      // 3. Soruları ve Şıkları Oluştur
      if (reqBody.questions && Array.isArray(reqBody.questions)) {
        for (const [idx, q] of reqBody.questions.entries()) {
          const question = await tx.question.create({
            data: {
              trainingId: t.id,
              questionText: q.text || `Soru ${idx + 1}`,
              points: Number(q.points) || 10,
              sortOrder: idx,
            }
          })

          if (q.options && Array.isArray(q.options)) {
            for (const [optIdx, opt] of q.options.entries()) {
              await tx.questionOption.create({
                data: {
                  questionId: question.id,
                  optionText: opt || `Şık ${optIdx + 1}`,
                  isCorrect: Number(q.correct) === optIdx,
                  sortOrder: optIdx,
                }
              })
            }
          }
        }
      }

      // 4. Personel Atamalarını Yap
      if (reqBody.selectedDepts && Array.isArray(reqBody.selectedDepts) && reqBody.selectedDepts.length > 0) {
        // Departman ismiyle kayıtlı personelleri bul
        const usersToAssign = await tx.user.findMany({
          where: {
            organizationId: dbUser!.organizationId!,
            isActive: true,
            department: { in: reqBody.selectedDepts },
          }
        })
        
        const excludedSet = new Set(reqBody.excludedStaff || [])
        const assignments = usersToAssign
          .filter(u => !excludedSet.has(u.id))
          .map(u => ({
            trainingId: t.id,
            userId: u.id,
            maxAttempts: parsed.data.maxAttempts || 3,
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
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: dbUser!.organizationId,
      action: 'training.create.full',
      entityType: 'training',
      entityId: training.id,
      newData: { title: training.title },
    })

    return jsonResponse(training, 201)
  } catch (err: unknown) {
    return errorResponse((err as Error).message || 'Eğitim kaydedilirken bir hata oluştu', 500)
  }
}
