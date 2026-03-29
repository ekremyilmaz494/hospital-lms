import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)
    const status = searchParams.get('status') // assigned | in_progress | passed | failed

    const where: Record<string, unknown> = {
      userId: dbUser!.id,
      training: { organizationId: dbUser!.organizationId! },
    }
    if (status) where.status = status

    const [assignments, totalCount] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where,
        include: {
          training: {
            include: {
              _count: { select: { questions: true, videos: true } },
            },
          },
          examAttempts: { orderBy: { attemptNumber: 'desc' } },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trainingAssignment.count({ where }),
    ])

    const now = new Date()

    const result = assignments.map(a => {
      const t = a.training
      const latestAttempt = a.examAttempts[0]

      // Calculate progress: 3 steps (pre-exam, videos, post-exam)
      let completedSteps = 0
      const preExamDone = a.examAttempts.some(att => att.preExamCompletedAt !== null)
      const videosDone = a.examAttempts.some(att => att.videosCompletedAt !== null)
      const postExamDone = a.examAttempts.some(att => att.postExamCompletedAt !== null)
      if (preExamDone) completedSteps++
      if (videosDone) completedSteps++
      if (postExamDone) completedSteps++
      const progress = Math.round((completedSteps / 3) * 100)

      // Days left until deadline
      const deadline = t.endDate
      let daysLeft: number | undefined
      if (deadline) {
        const diff = deadline.getTime() - now.getTime()
        daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      // Score from latest completed attempt
      const score = latestAttempt?.postExamScore ? Number(latestAttempt.postExamScore) : undefined

      return {
        id: a.id,
        title: t.title,
        category: t.category ?? '',
        status: a.status,
        attempt: a.examAttempts.length,
        maxAttempts: t.maxAttempts,
        deadline: deadline ? deadline.toLocaleDateString('tr-TR') : '',
        progress,
        daysLeft,
        score,
      }
    })

    return jsonResponse({
      data: result,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    })
  } catch (err) {
    logger.error('Staff MyTrainings', 'Eğitimler yüklenemedi', err)
    return errorResponse('Eğitimler yüklenemedi', 503)
  }
}
