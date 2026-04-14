import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog, safePagination, checkWritePermission } from '@/lib/api-helpers'
import { createTrainingBodySchema } from '@/lib/validations'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { withCache, invalidateOrgCache } from '@/lib/redis'

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

  const orgId = dbUser!.organizationId!
  const cacheKey = `cache:${orgId}:trainings:${page}:${limit}:${search}:${category || ''}:${isActive || ''}:${publishStatus || ''}`

  const data = await withCache(cacheKey, 120, async () => {
    const where: Record<string, unknown> = {
      organizationId: orgId,
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
        select: {
          id: true, title: true, category: true, passingScore: true,
          publishStatus: true, startDate: true, endDate: true,
          _count: { select: { assignments: true, questions: true, videos: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.training.count({ where }),
    ])

    // Toplu completedCount sorgusu — tüm assignment row'larını çekmek yerine tek groupBy
    const trainingIds = trainings.map(t => t.id)
    const completedCounts = trainingIds.length > 0
      ? await prisma.trainingAssignment.groupBy({
          by: ['trainingId'],
          where: { trainingId: { in: trainingIds }, status: 'passed' },
          _count: true,
        })
      : []
    const completedMap = new Map(completedCounts.map(c => [c.trainingId, c._count]))

    const mapped = trainings.map(t => {
      const assignedCount = t._count.assignments
      const completedCount = completedMap.get(t.id) ?? 0
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

    return { trainings: mapped, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

  return jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const writeBlock = await checkWritePermission(dbUser!.organizationId!, 'POST')
  if (writeBlock) return writeBlock

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

      // 2. Videoları Oluştur (doğrudan URL veya medya kütüphanesinden)
      if (videos && videos.length > 0) {
        for (const [idx, v] of videos.entries()) {
          let url = v.url
          let ct = v.contentType || 'video'
          let duration = v.durationSeconds || (ct === 'video' ? 300 : 0)
          const docKey = v.documentKey ?? null
          const pgCount = v.pageCount ?? null
          let videoTitle = v.title

          // Medya kütüphanesinden seçim — libraryItemId varsa bilgileri oradan çek
          if ((v as Record<string, unknown>).libraryItemId) {
            const libItem = await tx.contentLibrary.findFirst({
              where: { id: (v as Record<string, unknown>).libraryItemId as string, organizationId: dbUser!.organizationId! },
            })
            if (libItem?.s3Key) {
              url = libItem.s3Key
              ct = (libItem.contentType as typeof ct) || 'video'
              duration = (libItem.duration || 0) * 60
              videoTitle = videoTitle || libItem.title
            }
          }

          if (!url) continue
          const defaultTitle = url.split('/').pop()?.replace(/\.[^.]+$/, '') || (ct === 'pdf' ? `Doküman ${idx + 1}` : `Video ${idx + 1}`)

          await tx.trainingVideo.create({
            data: {
              trainingId: t.id,
              title: videoTitle || defaultTitle,
              videoUrl: url,
              videoKey: url,
              durationSeconds: duration,
              contentType: ct,
              pageCount: pgCount,
              documentKey: docKey,
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
    try { await invalidateOrgCache(dbUser!.organizationId!, 'trainings') } catch {}

    return jsonResponse(training, 201)
  } catch (err: unknown) {
    return errorResponse((err as Error).message || 'Eğitim kaydedilirken bir hata oluştu', 500)
  }
}
