import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { calculateTrainingProgress } from '@/lib/training-progress'
import { logger } from '@/lib/logger'
import { getStaffOrgIds } from '@/lib/staff-orgs'
import { toEndOfDayUTC } from '@/lib/date-helpers'

export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)
    const status = searchParams.get('status') // assigned | in_progress | passed | failed
    const periodIdParam = searchParams.get('periodId')

    // periodId param varsa o dönemi kullan; yoksa aktif döneme düş.
    // Boş liste senaryosunda UI'ın doğru mesaj gösterebilmesi için `meta.reason`
    // ekleniyor — "atama yok" ile "aktif dönem yok" durumlarını karıştırma.
    // Ortak personel (Faz 2.4 birleşik gelen kutusu): doktor TÜM hastanelerindeki (primary +
    // aktif üyelik) atamalarını tek listede görür. Tekil-org'da myOrgs=[A] → {in:[A]}=A (INERT).
    const myOrgs = await getStaffOrgIds(dbUser.id, organizationId)

    let periodFilter: string | { in: string[] }
    if (periodIdParam) {
      const period = await prisma.trainingPeriod.findFirst({
        where: { id: periodIdParam, organizationId: { in: myOrgs } },
        select: { id: true },
      })
      if (!period) {
        return jsonResponse({
          data: [], page, limit, totalCount: 0, totalPages: 0,
          meta: { reason: 'period_not_found' as const },
        }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
      }
      periodFilter = period.id
    } else {
      // Her hastanenin KENDİ aktif dönemi var → ortak doktorun A+B aktif dönemlerini birlikte topla.
      const activePeriods = await prisma.trainingPeriod.findMany({
        where: { organizationId: { in: myOrgs }, status: 'active' },
        select: { id: true },
      })
      if (activePeriods.length === 0) {
        return jsonResponse({
          data: [], page, limit, totalCount: 0, totalPages: 0,
          meta: { reason: 'no_active_period' as const },
        }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
      }
      periodFilter = { in: activePeriods.map(p => p.id) }
    }

    // Arşivlenmiş veya soft-delete edilmiş eğitimler personel listesinde gözükmemeli;
    // aksi halde personel "asla bitiremeyeceği" eğitim görür (bkz. PDF-only edge case).
    const where: Record<string, unknown> = {
      userId: dbUser.id,
      periodId: periodFilter,
      training: {
        organizationId: { in: myOrgs },
        isActive: true,
        publishStatus: { not: 'archived' },
      },
    }
    if (status) where.status = status

    const [assignments, totalCount] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where,
        include: {
          training: {
            select: {
              title: true,
              category: true,
              maxAttempts: true,
              startDate: true,
              endDate: true,
              examOnly: true,
              examDurationMinutes: true,
              passingScore: true,
              scormEntryPoint: true,
              organization: { select: { name: true } }, // hastane etiketi (ortak personel)
              _count: { select: { questions: true, videos: true } },
            },
          },
          examAttempts: {
            select: {
              preExamCompletedAt: true,
              videosCompletedAt: true,
              postExamCompletedAt: true,
              postExamScore: true,
              attemptNumber: true,
              status: true,
            },
            orderBy: { attemptNumber: 'desc' },
            take: 1,
          },
          _count: { select: { examAttempts: true } },
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

      // Tek doğruluk kaynağı — examOnly + retry farkını içerir.
      const { percent: progress } = calculateTrainingProgress({
        examOnly: t.examOnly === true,
        attemptNumber: latestAttempt?.attemptNumber ?? 0,
        preExamCompleted: latestAttempt?.preExamCompletedAt != null,
        videosCompleted: latestAttempt?.videosCompletedAt != null,
        postExamCompleted: latestAttempt?.postExamCompletedAt != null,
      })

      // Days left until deadline — end-of-day mantığı: "16 Mayıs" son tarihliyse
      // 16 May 23:59:59'a kadar geçerli. Eski kayıtlar 00:00:00 ile saklanmış
      // olabilir, normalize ederek dürüst gün sayısı veriyoruz.
      const deadline = t.endDate
      let daysLeft: number | undefined
      if (deadline) {
        const eod = toEndOfDayUTC(deadline)
        const diff = eod.getTime() - now.getTime()
        daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      // Henüz açılmamış eğitim: start_date > now. UI'da kilitli kart + "X tarihinde
      // açılacak" mesajı göstermek için. API hâlâ kaydı döndürür (kullanıcı eğitimin
      // geleceğini bilsin), giriş engellemesi exam start endpoint'inde.
      const isNotStarted = t.startDate ? now < t.startDate : false

      // Score from latest completed attempt
      const score = latestAttempt?.postExamScore ? Number(latestAttempt.postExamScore) : undefined

      return {
        id: a.id,
        title: t.title,
        category: t.category ?? '',
        status: a.status,
        attempt: (a as unknown as { _count: { examAttempts: number } })._count.examAttempts,
        // Atama-tabanlı oku: bireysel hibe edilmiş hakları (attempt-requests /
        // reset-attempt) yansıtmak ve detay endpoint (assignment.maxAttempts)
        // ile tutarlı olmak için. Training.maxAttempts edit cascade'i atama
        // satırlarını da günceller (apps/web/src/app/api/admin/trainings/[id]/route.ts).
        maxAttempts: a.maxAttempts,
        startDate: t.startDate ? t.startDate.toLocaleDateString('tr-TR') : null,
        isNotStarted,
        deadline: deadline ? deadline.toLocaleDateString('tr-TR') : '',
        progress,
        daysLeft,
        score,
        examOnly: t.examOnly,
        questionCount: t._count.questions,
        examDurationMinutes: t.examDurationMinutes,
        passingScore: t.passingScore,
        // Mobil, SCORM eğitimini tespit edip indir-ve-oynat akışına yönlendirmek
        // ve listede "SCORM" rozeti göstermek için kullanır (web kullanmaz, additive).
        isScorm: t.scormEntryPoint != null,
        // Ortak personel: eğitimin hangi hastaneden olduğu. Tekil-org'da null (UI etiket göstermez);
        // çok-hastaneli doktorda hastane adı → UI "hangi hastane" rozetini basar.
        hospitalName: myOrgs.length > 1 ? (t.organization?.name ?? null) : null,
      }
    })

    return jsonResponse({
      data: result,
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('Staff MyTrainings', 'Eğitimler yüklenemedi', err)
    return errorResponse('Eğitimler yüklenemedi', 503)
  }
}, { requireOrganization: true })
