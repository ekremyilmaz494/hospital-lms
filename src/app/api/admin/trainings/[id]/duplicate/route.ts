import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/trainings/[id]/duplicate
 * Mevcut bir eğitimi (video + sorularıyla birlikte) kopyalar.
 * Atamalar ve sınav denemeleri kopyalanmaz.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  try {
    // Kaynak eğitimi doğrula
    const source = await prisma.training.findFirst({
      where: { id, organizationId: orgId },
      include: {
        videos: { orderBy: { sortOrder: 'asc' } },
        questions: { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!source) return errorResponse('Eğitim bulunamadı', 404)

    const newTraining = await prisma.$transaction(async (tx) => {
      // Yeni eğitimi oluştur
      const training = await tx.training.create({
        data: {
          organizationId: orgId,
          title: `${source.title} (Kopya)`,
          description: source.description,
          category: source.category,
          thumbnailUrl: source.thumbnailUrl,
          passingScore: source.passingScore,
          maxAttempts: source.maxAttempts,
          examDurationMinutes: source.examDurationMinutes,
          startDate: source.startDate,
          endDate: source.endDate,
          isActive: false, // Taslak olarak başla
          isCompulsory: source.isCompulsory,
          complianceDeadline: source.complianceDeadline,
          regulatoryBody: source.regulatoryBody,
          renewalPeriodMonths: source.renewalPeriodMonths,
          createdById: dbUser!.id,
        },
      })

      // Videoları kopyala (aynı S3 key referansları)
      if (source.videos.length > 0) {
        await tx.trainingVideo.createMany({
          data: source.videos.map(v => ({
            trainingId: training.id,
            title: v.title,
            description: v.description,
            videoUrl: v.videoUrl,
            videoKey: v.videoKey,
            durationSeconds: v.durationSeconds,
            sortOrder: v.sortOrder,
          })),
        })
      }

      // Soruları ve şıkları kopyala — N sorgu yerine 2 sorgu (createMany + client UUID)
      if (source.questions.length > 0) {
        const questionsWithIds = source.questions.map(q => ({ ...q, newId: randomUUID() }))

        await tx.question.createMany({
          data: questionsWithIds.map(q => ({
            id: q.newId,
            trainingId: training.id,
            organizationId: orgId,
            questionText: q.questionText,
            questionType: q.questionType,
            points: q.points,
            sortOrder: q.sortOrder,
          })),
        })

        const allOptions = questionsWithIds.flatMap(q =>
          q.options.map(o => ({
            questionId: q.newId,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            sortOrder: o.sortOrder,
          }))
        )
        if (allOptions.length > 0) {
          await tx.questionOption.createMany({ data: allOptions })
        }
      }

      return training
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'duplicate',
      entityType: 'training',
      entityId: newTraining.id,
      newData: { sourceId: id, sourceTitle: source.title },
      request,
    })

    return jsonResponse({ id: newTraining.id, title: newTraining.title }, 201)
  } catch (err) {
    logger.error('Training Duplicate', 'Eğitim kopyalanamadı', err)
    return errorResponse('Eğitim kopyalanamadı', 500)
  }
}
