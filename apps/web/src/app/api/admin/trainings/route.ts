import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { turkishSearchIds } from '@/lib/turkish-search'
import { createTrainingBodySchema } from '@/lib/validations'
import { checkSubscriptionLimit } from '@/lib/subscription-guard'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { withCache, invalidateOrgCache } from '@/lib/redis'
import type { AssignmentStatus } from '@/lib/exam-state-machine'
import { getOrCreateActivePeriodForAssignment } from '@/lib/training-periods'
import { sendExpoPushToMany } from '@/lib/expo-push'
import { logger } from '@/lib/logger'
import { toEndOfDayUTC } from '@/lib/date-helpers'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams)
  const category = searchParams.get('category')
  const isActive = searchParams.get('isActive')
  const publishStatus = searchParams.get('publishStatus') // draft | published | archived

  const orgId = organizationId
  const cacheKey = `cache:${orgId}:trainings:${page}:${limit}:${search}:${category || ''}:${isActive || ''}:${publishStatus || ''}`

  const data = await withCache(cacheKey, 120, async () => {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      isActive: true,
    }

    if (search) {
      // Türkçe-duyarlı arama (bkz. turkishSearchIds)
      where.id = { in: await turkishSearchIds('trainings', ['title', 'description'], search, orgId) }
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
          where: { trainingId: { in: trainingIds }, status: 'passed' satisfies AssignmentStatus },
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
}, { requireOrganization: true })

export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  // Abonelik limit kontrolu
  const limitError = await checkSubscriptionLimit(organizationId, 'training')
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

  // Validation: end-of-day mantığı — bugün son tarih seçilirse "geçmişte" sayılmaz.
  if (toEndOfDayUTC(parsed.data.endDate) < new Date()) {
    return errorResponse('Bitiş tarihi geçmişte olamaz', 400)
  }

  const { videos, questions, selectedDepts, excludedStaff, ...trainingData } = parsed.data

  // Eğitim oluşturma sırasında departman ataması yapılıyorsa aktif döneme ihtiyaç var.
  // Aktif period yoksa otomatik aç — atamalar daima bir period'a bağlanır.
  // Transaction dışında fetch edilir — tx ile çalışmaz, isolation bozulmaz.
  let activePeriodId: string | null = null
  if (selectedDepts && selectedDepts.length > 0) {
    const period = await getOrCreateActivePeriodForAssignment(organizationId)
    activePeriodId = period.status === 'closed' ? null : period.id
  }

  try {
    const training = await prisma.$transaction(async (tx) => {
      // Aktif feedback formu varsa yeni eğitim de aynı zorunluluk politikasını
      // miras alır — aksi halde admin "Tüm Eğitimlere Ata" yapsa bile sonradan
      // eklenen eğitim feedbackMandatory=false ile kalır ve sertifika gating
      // bypass eder. Aktif form yoksa default false (eski davranış).
      const activeForm = await tx.trainingFeedbackForm.findFirst({
        where: { organizationId, isActive: true, isArchived: false },
        select: { isMandatory: true },
      })
      const inheritedFeedbackMandatory = activeForm?.isMandatory ?? false

      // 1. Eğitimi Oluştur
      const t = await tx.training.create({
        data: {
          ...trainingData,
          // Client gönderdiyse onu kullan, yoksa aktif form mirasını al.
          feedbackMandatory: trainingData.feedbackMandatory ?? inheritedFeedbackMandatory,
          startDate: new Date(trainingData.startDate),
          // endDate'i gün sonuna normalize et — "16 Mayıs" girildiyse 16 May
          // 23:59:59 UTC olarak kaydet ki personel o günün sonuna kadar erişebilsin.
          endDate: toEndOfDayUTC(trainingData.endDate),
          complianceDeadline: trainingData.complianceDeadline ? new Date(trainingData.complianceDeadline) : null,
          organizationId: organizationId,
          createdById: dbUser.id,
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

          // Medya kütüphanesinden seçim — sourceMediaAssetId varsa bilgileri oradan çek.
          // (Artık şemada tanımlı; eskiden cast'leniyordu ama zod siliyordu — bkz validations.ts.)
          const sourceMediaAssetId = v.sourceMediaAssetId
          if (sourceMediaAssetId) {
            const asset = await tx.mediaAsset.findFirst({
              where: { id: sourceMediaAssetId, organizationId: organizationId },
            })
            // Güvenlik (güven sınırı): kütüphane seçimi YALNIZ kendi kurumunun
            // asset'inden çözülür. Asset bulunamazsa (cross-tenant/forge veya silinmiş)
            // bu öğe ATLANIR — client'ın gönderdiği url'e ASLA fallback yapılmaz
            // (aksi halde sahte istek başka org'un key'ini videoKey'e yazabilirdi).
            if (!asset?.s3Key) continue
            url = asset.s3Key
            ct = (asset.mediaType as typeof ct) || 'video'
            duration = asset.durationSeconds || 0
            videoTitle = videoTitle || asset.title
          }

          // Savunma: çözümlenmemiş kütüphane sentinel'i (library://...) ASLA videoKey olmaz.
          // (Normalde yukarıdaki blok url'i asset.s3Key ile değiştirir; bu, forge/eksik
          // sourceMediaAssetId durumunda son emniyet.)
          if (!url || url.startsWith('library://')) continue
          const defaultTitle = url.split('/').pop()?.replace(/\.[^.]+$/, '') || (ct === 'pdf' ? `Doküman ${idx + 1}` : `Video ${idx + 1}`)

          await tx.trainingVideo.create({
            data: {
              trainingId: t.id,
              title: videoTitle || defaultTitle,
              // Kanonik kaynak videoKey; videoUrl boş kalır (CLAUDE.md Video URL Kuralı).
              // Ham key'i videoUrl'e yazmak frontend fallback'ini zehirler.
              videoUrl: '',
              videoKey: url,
              durationSeconds: duration,
              contentType: ct,
              pageCount: pgCount,
              documentKey: docKey,
              sortOrder: idx,
              // Kütüphaneden seçildiyse soft geri-bağ (silme engellemez).
              sourceMediaAssetId: sourceMediaAssetId ?? null,
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
        // Hiyerarşi expansion: selectedDepts içinde parent departman varsa,
        // onun child departmanlarını da dahil et. Frontend parent seçili iken child'ı
        // "otomatik dahil" gösteriyor, backend de aynı semantiği uygulamalı.
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
            organizationId: organizationId,
            isActive: true,
            departmentId: { in: allDeptIds },
          }
        })

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

        if (assignments.length > 0) {
          await tx.trainingAssignment.createMany({
            data: assignments,
            skipDuplicates: true,
          })
        }
      }

      return t
    }, { timeout: 30000 })

    // Atanan personellere otomatik bildirim + Expo push.
    // Why: Personel admin'in eğitim tanımladığını ve hangi tarihler arasında
    // tamamlaması gerektiğini anlık öğrensin. Notification.createMany toplu insert,
    // sendExpoPushToMany fire-and-forget (admin response'unu bloklamaz).
    try {
      const assignedRows = await prisma.trainingAssignment.findMany({
        where: { trainingId: training.id, organizationId },
        select: { userId: true },
      })
      const assignedUserIds = assignedRows.map(r => r.userId)

      if (assignedUserIds.length > 0) {
        const startStr = new Date(trainingData.startDate).toLocaleDateString('tr-TR')
        const endStr = new Date(trainingData.endDate).toLocaleDateString('tr-TR')
        const notifTitle = 'Yeni Eğitim Atandı'
        const notifMessage = `"${training.title}" adlı eğitim sizlere atandı. ${startStr} – ${endStr} tarihleri arasında tamamlamanız gerekmektedir.`

        await prisma.notification.createMany({
          data: assignedUserIds.map(uid => ({
            userId: uid,
            organizationId,
            senderId: dbUser.id,
            title: notifTitle,
            message: notifMessage,
            type: 'assignment',
            relatedTrainingId: training.id,
          })),
        })

        void sendExpoPushToMany(assignedUserIds, {
          title: notifTitle,
          body: notifMessage,
          url: `/trainings/${training.id}`,
          data: { trainingId: training.id, type: 'assignment' },
        })
      }
    } catch (notifErr) {
      // Bildirim hatası eğitim oluşturmayı geçersiz kılmasın — eğitim zaten yaratıldı.
      logger.error('admin-trainings-create', 'Atama bildirimi gönderilemedi', notifErr)
    }

    await audit({
      action: 'training.create.full',
      entityType: 'training',
      entityId: training.id,
      newData: { title: training.title },
    })

    revalidatePath('/staff/my-trainings')
    revalidatePath('/admin/trainings')

    try { await invalidateDashboardCache(organizationId) } catch {}
    try { await invalidateOrgCache(organizationId, 'trainings') } catch {}

    return jsonResponse(training, 201)
  } catch (err: unknown) {
    // Ham err.message (Prisma constraint/tablo/kolon adı vb.) kullanıcıya sızdırılmaz —
    // sunucuya logla, kullanıcıya generic Türkçe mesaj dön.
    logger.error('admin-trainings-create', 'Eğitim kaydedilirken hata', err)
    return errorResponse('Eğitim kaydedilirken bir hata oluştu', 500)
  }
}, { requireOrganization: true })
