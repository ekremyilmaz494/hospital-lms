import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createTrainingBodySchema } from '@/lib/validations'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { invalidateOrgCache } from '@/lib/redis'
import { findActivePeriod } from '@/lib/training-periods'

/**
 * POST /api/admin/trainings/[id]/publish
 *
 * Var olan bir taslağı (publishStatus='draft') alır, body'deki finalize edilmiş
 * payload'ı `createTrainingBodySchema` ile validate eder ve eğitimi yayınlar:
 *  - Training row'unun zorunlu alanlarını günceller, publishStatus='published'
 *  - Var olan video/question kayıtlarını siler, draftData'dakileri yeniden yaratır
 *  - Departman atamalarını oluşturur (mevcut /api/admin/trainings POST mantığıyla aynı)
 *  - draft_data + draft_step alanlarını temizler
 *
 * `/api/admin/trainings` POST endpoint'i değişmedi — eski ekran/akışlar bozulmaz.
 * Wizard "Yayınla" butonu artık bu endpoint'i çağırır.
 */
export const POST = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz veri', 400)

  const parsed = createTrainingBodySchema.safeParse(body)
  if (!parsed.success) {
    try {
      const issues = JSON.parse(parsed.error.message)
      return errorResponse(`Eksik veya hatalı bilgi: ${issues.map((i: { path: string[]; message?: string }) => `${i.path.join('.')}${i.message ? ` (${i.message})` : ''}`).join(', ')}`, 400)
    } catch {
      return errorResponse(parsed.error.message, 400)
    }
  }

  if (new Date(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  // Ownership kontrolü
  const draft = await prisma.training.findFirst({
    where: {
      id: params.id,
      organizationId,
      publishStatus: 'draft',
      ...(dbUser.role === 'super_admin' ? {} : { createdById: dbUser.id }),
    },
    select: { id: true, createdById: true },
  })
  if (!draft) return errorResponse('Taslak bulunamadı', 404)

  const { videos, questions, selectedDepts, excludedStaff, ...trainingData } = parsed.data

  let activePeriodId: string | null = null
  if (selectedDepts && selectedDepts.length > 0) {
    const period = await findActivePeriod(organizationId)
    activePeriodId = period?.id ?? null
  }

  try {
    const training = await prisma.$transaction(async (tx) => {
      const activeForm = await tx.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true, isArchived: false },
        select: { isMandatory: true },
      })
      const inheritedFeedbackMandatory = activeForm?.isMandatory ?? false

      // 1) Training row'u güncelle — yayına geçir
      const t = await tx.training.update({
        where: { id: draft.id },
        data: {
          ...trainingData,
          feedbackMandatory: trainingData.feedbackMandatory ?? inheritedFeedbackMandatory,
          startDate: new Date(trainingData.startDate),
          endDate: new Date(trainingData.endDate),
          complianceDeadline: trainingData.complianceDeadline ? new Date(trainingData.complianceDeadline) : null,
          publishStatus: 'published',
          isActive: true,
          // Wizard state'i temizlenir — taslaklar listesinde tekrar görünmesin
          draftData: Prisma.JsonNull,
          draftStep: null,
          draftUpdatedAt: null,
        },
      })

      // 2) Önceki video/soru kayıtlarını temizle (idempotent re-publish için)
      await tx.trainingVideo.deleteMany({ where: { trainingId: t.id } })
      // Question'lar cascade ile QuestionOption'ı siler
      await tx.question.deleteMany({ where: { trainingId: t.id } })

      // 3) Videoları yeniden yarat
      if (videos && videos.length > 0) {
        for (const [idx, v] of videos.entries()) {
          let url = v.url
          let ct = v.contentType || 'video'
          let duration = v.durationSeconds || (ct === 'video' ? 300 : 0)
          const docKey = v.documentKey ?? null
          const pgCount = v.pageCount ?? null
          let videoTitle = v.title

          if ((v as Record<string, unknown>).libraryItemId) {
            const libItem = await tx.contentLibrary.findFirst({
              where: { id: (v as Record<string, unknown>).libraryItemId as string, organizationId },
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
            },
          })
        }
      }

      // 4) Soruları + Şıkları yeniden yarat
      if (questions && questions.length > 0) {
        for (const [idx, q] of questions.entries()) {
          const question = await tx.question.create({
            data: {
              trainingId: t.id,
              questionText: q.text,
              points: q.points,
              sortOrder: idx,
            },
          })
          for (const [optIdx, opt] of q.options.entries()) {
            await tx.questionOption.create({
              data: {
                questionId: question.id,
                optionText: opt,
                isCorrect: q.correct === optIdx,
                sortOrder: optIdx,
              },
            })
          }
        }
      }

      // 5) Departman atamalarını yarat (yeniden yayında: mevcut atamalara dokunulmaz,
      //    skipDuplicates ile yalnızca eksikler eklenir)
      if (selectedDepts && selectedDepts.length > 0) {
        const expandedDepts = await tx.department.findMany({
          where: {
            organizationId,
            OR: [
              { id: { in: selectedDepts } },
              { parentId: { in: selectedDepts } },
            ],
          },
          select: { id: true },
        })
        const allDeptIds = expandedDepts.map(d => d.id)

        const usersToAssign = await tx.user.findMany({
          where: {
            organizationId,
            isActive: true,
            departmentId: { in: allDeptIds },
          },
        })

        const excludedSet = new Set(excludedStaff || [])
        const assignments = usersToAssign
          .filter(u => !excludedSet.has(u.id))
          .map(u => ({
            trainingId: t.id,
            userId: u.id,
            ...(activePeriodId && { periodId: activePeriodId }),
            maxAttempts: trainingData.maxAttempts || 3,
            originalMaxAttempts: trainingData.maxAttempts || 3,
            assignedById: dbUser.id,
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

    await audit({
      action: 'training.publish',
      entityType: 'training',
      entityId: training.id,
      newData: { title: training.title },
    })

    revalidatePath('/staff/my-trainings')
    revalidatePath('/admin/trainings')

    try { await invalidateDashboardCache(organizationId) } catch {}
    try { await invalidateOrgCache(organizationId, 'trainings') } catch {}

    return jsonResponse(training, 200)
  } catch (err) {
    return errorResponse((err as Error).message || 'Eğitim yayınlanırken bir hata oluştu', 500)
  }
}, { requireOrganization: true })
