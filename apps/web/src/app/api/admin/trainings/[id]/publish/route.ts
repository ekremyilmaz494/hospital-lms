import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createTrainingBodySchema } from '@/lib/validations'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { invalidateOrgCache, checkRateLimit } from '@/lib/redis'
import { getOrCreateActivePeriodForAssignment } from '@/lib/training-periods'
import { logger } from '@/lib/logger'
import { toEndOfDayUTC } from '@/lib/date-helpers'

/**
 * Transaction içinde atılan, kullanıcı-yüzlü hata mesajı taşıyan sentinel error.
 * Dış catch bunu yakalayıp 400 + mesaj döner; diğer hatalar generic 500'e düşer.
 */
class PublishValidationError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage)
    this.name = 'PublishValidationError'
  }
}

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
  // Rate limit: yayın ağır bir işlem (transaction + multi-table writes + cache invalidation).
  // Saatte 30 yayın çoğu admin için yeterli; bot'u yavaşlatır.
  const allowed = await checkRateLimit(`training-publish:${dbUser.id}`, 30, 3600)
  if (!allowed) return errorResponse('Çok fazla yayın işlemi, lütfen biraz sonra tekrar deneyin', 429)

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

  if (toEndOfDayUTC(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  // Yayın için sıkı sanity check'ler — şema tek başına yetmez çünkü
  // createTrainingBodySchema'da videos/questions/selectedDepts optional
  // (taslak güncellemelerinde de kullanılan ortak şema). Yayın anında
  // sorusuz veya atamasız eğitim üretmek tamamlanmamış akış demek.
  if (!parsed.data.questions || parsed.data.questions.filter(q => q.text.trim()).length === 0) {
    return errorResponse('Yayın için en az 1 soru tanımlanmalıdır.', 400)
  }
  if (!parsed.data.selectedDepts || parsed.data.selectedDepts.length === 0) {
    return errorResponse(
      parsed.data.isCompulsory
        ? 'Zorunlu eğitim en az bir departmana atanmalıdır.'
        : 'En az bir departman seçilmelidir; aksi halde eğitim hiç kimseye atanmaz.',
      400,
    )
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

  // Aktif period yoksa otomatik aç — POST /api/admin/trainings ile aynı semantik:
  // taze kurulan org'da bile yayın atamaları daima bir period'a bağlanır.
  let activePeriodId: string | null = null
  if (selectedDepts && selectedDepts.length > 0) {
    const period = await getOrCreateActivePeriodForAssignment(organizationId)
    activePeriodId = period.status === 'closed' ? null : period.id
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
          // endDate gün sonuna normalize (POST /api/admin/trainings ile aynı semantik)
          endDate: toEndOfDayUTC(trainingData.endDate),
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

      // 3) Videoları yeniden yarat — N sıralı create yerine tek createMany.
      // Library item lookup'ları paralel toplanır (sıralı await yerine Promise.all).
      if (videos && videos.length > 0) {
        const libItemIds = videos
          .map(v => (v as Record<string, unknown>).libraryItemId as string | undefined)
          .filter((id): id is string => !!id)
        const libItems = libItemIds.length > 0
          ? await tx.contentLibrary.findMany({
              where: { id: { in: libItemIds }, organizationId },
            })
          : []
        const libMap = new Map(libItems.map(l => [l.id, l]))

        const videoData = videos
          .map((v, idx) => {
            let url = v.url
            let ct = v.contentType || 'video'
            let duration = v.durationSeconds || (ct === 'video' ? 300 : 0)
            const docKey = v.documentKey ?? null
            const pgCount = v.pageCount ?? null
            let videoTitle = v.title

            const libId = (v as Record<string, unknown>).libraryItemId as string | undefined
            if (libId) {
              const libItem = libMap.get(libId)
              if (libItem?.s3Key) {
                url = libItem.s3Key
                ct = (libItem.contentType as typeof ct) || 'video'
                duration = (libItem.duration || 0) * 60
                videoTitle = videoTitle || libItem.title
              }
            }

            if (!url) return null
            const defaultTitle = url.split('/').pop()?.replace(/\.[^.]+$/, '') || (ct === 'pdf' ? `Doküman ${idx + 1}` : `Video ${idx + 1}`)
            return {
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
          .filter((d): d is NonNullable<typeof d> => d !== null)

        if (videoData.length > 0) {
          await tx.trainingVideo.createMany({ data: videoData })
        }
      }

      // 4) Soruları + Şıkları yeniden yarat — N sıralı yerine 2 createMany batch.
      // Question'ları önce createMany ile yarat, sonra ID'leri findMany ile topla,
      // option'ları tek createMany ile insert et. (Postgres createMany returnId desteklemiyor)
      if (questions && questions.length > 0) {
        await tx.question.createMany({
          data: questions.map((q, idx) => ({
            trainingId: t.id,
            questionText: q.text,
            points: q.points,
            sortOrder: idx,
          })),
        })
        const insertedQuestions = await tx.question.findMany({
          where: { trainingId: t.id },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, sortOrder: true },
        })
        const optionData = questions.flatMap((q, qIdx) => {
          const qId = insertedQuestions.find(iq => iq.sortOrder === qIdx)?.id
          if (!qId) return []
          return q.options.map((opt, optIdx) => ({
            questionId: qId,
            optionText: opt,
            isCorrect: q.correct === optIdx,
            sortOrder: optIdx,
          }))
        })
        if (optionData.length > 0) {
          await tx.questionOption.createMany({ data: optionData })
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

        // P0 §2.7 — Boş atama sessiz pass'i engelle: seçilen departmanlar silinmişse veya
        // içlerinde aktif kullanıcı kalmamışsa publish 400 ile başarısız olmalı; admin
        // "yayınlandı" sanıp hiç kimseye atama yapılmamış durumla karşılaşmamalı.
        if (usersToAssign.length === 0) {
          throw new PublishValidationError(
            'Seçilen departmanlarda atama yapılabilecek aktif personel bulunamadı. ' +
            'Departman silinmiş veya içinde aktif kullanıcı yok olabilir.',
          )
        }

        const excludedSet = new Set(excludedStaff || [])
        const assignments = usersToAssign
          .filter(u => !excludedSet.has(u.id))
          .map(u => ({
            trainingId: t.id,
            userId: u.id,
            organizationId,
            ...(activePeriodId && { periodId: activePeriodId }),
            maxAttempts: trainingData.maxAttempts || 3,
            originalMaxAttempts: trainingData.maxAttempts || 3,
            assignedById: dbUser.id,
          }))

        if (assignments.length === 0) {
          throw new PublishValidationError(
            'Tüm hedef personeller hariç tutulmuş; yayınlamak için en az 1 kişi kalmalı.',
          )
        }

        await tx.trainingAssignment.createMany({
          data: assignments,
          skipDuplicates: true,
        })
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
    if (err instanceof PublishValidationError) {
      return errorResponse(err.userMessage, 400)
    }
    logger.error('training-publish', 'Yayın hatası', err instanceof Error ? err.message : err)
    return errorResponse('Eğitim yayınlanırken bir hata oluştu', 500)
  }
}, { requireOrganization: true })
