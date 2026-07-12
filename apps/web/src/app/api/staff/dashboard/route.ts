import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { calculateTrainingProgress } from '@/lib/training-progress'
import { logger } from '@/lib/logger'
import { getCached, setCached } from '@/lib/redis'
import { getEffectiveStartDate } from '@/lib/training-periods'
import { getStaffOrgIds } from '@/lib/staff-orgs'

const CACHE_TTL = 60

// GET /api/staff/dashboard — Personel dashboard verileri
export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  const userId = dbUser.id

  try {
    const cacheKey = `staff:dashboard:${userId}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) {
      return jsonResponse(cached, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
    }

    // Ortak personel (Faz 2.4): doktorun TÜM hastanelerindeki (primary + aktif üyelik) aktif dönem
    // atamalarını birleştir. Tekil-org'da myOrgs=[A] → tek aktif dönem, davranış BİREBİR korunur.
    const myOrgs = await getStaffOrgIds(userId, organizationId)
    const multi = myOrgs.length > 1

    // Her hastanenin KENDİ aktif dönemi olabilir — hepsini topla (scope + eligibility için)
    const activePeriods = await prisma.trainingPeriod.findMany({
      where: { organizationId: { in: myOrgs }, status: 'active' },
      select: { id: true, startDate: true },
    })
    if (activePeriods.length === 0) {
      const empty = {
        stats: { assigned: 0, inProgress: 0, completed: 0, failed: 0, overallProgress: 0 },
        upcomingTrainings: [],
        urgentTraining: null,
        notifications: [],
        recentActivity: [],
      }
      return jsonResponse(empty, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
    }
    const activePeriodIds = activePeriods.map(p => p.id)
    const periodStartById = new Map(activePeriods.map(p => [p.id, p.startDate]))

    // 1) Assignments + attempts + notifications + recent activity — tümü paralel
    // Arşivlenmiş/pasif eğitimleri filtrele — my-trainings ile aynı görünürlük
    // (memory: feedback_archived_training_filter konvansiyonu).
    const [assignments, notifications, recentAttempts, currentUser] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where: {
          userId,
          periodId: { in: activePeriodIds },
          training: {
            organizationId: { in: myOrgs },
            isActive: true,
            publishStatus: { not: 'archived' },
          },
        },
        include: {
          training: {
            select: {
              id: true, title: true, category: true, examOnly: true,
              passingScore: true, startDate: true, endDate: true,
              organization: { select: { name: true } }, // hastane etiketi (ortak personel)
            },
          },
          examAttempts: {
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            select: {
              postExamScore: true, preExamScore: true, isPassed: true,
              status: true, attemptNumber: true,
              preExamCompletedAt: true, videosCompletedAt: true,
              postExamCompletedAt: true,
            },
          },
        },
        take: 200,
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, isRead: true, createdAt: true },
      }),
      prisma.examAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          status: true, isPassed: true, postExamScore: true,
          preExamCompletedAt: true, videosCompletedAt: true,
          postExamCompletedAt: true, createdAt: true,
          training: { select: { title: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { hireDate: true, createdAt: true },
      }),
    ])

    // Effective start: yıl içi gelen personel için işe başlama tarihinden say. Ortak personelde
    // her atama KENDİ hastanesinin dönem başına göre elenir (hastanelerin dönem başları farklı olabilir).
    const eligibleAssignments = assignments.filter(a => {
      const pStart = periodStartById.get(a.periodId ?? '')
      if (!pStart) return false // defansif — query zaten periodId'yi aktif dönemlerle sınırlıyor
      const effStart = currentUser
        ? getEffectiveStartDate(
            { hireDate: currentUser.hireDate, createdAt: currentUser.createdAt },
            { startDate: pStart },
          )
        : pStart
      return new Date(a.assignedAt) >= effStart
    })

    // 2) Assignment stats — effectiveStart sonrası atamalar üzerinden
    const assigned = eligibleAssignments.length
    const inProgress = eligibleAssignments.filter(a => a.status === 'in_progress').length
    const completed = eligibleAssignments.filter(a => a.status === 'passed').length
    const failed = eligibleAssignments.filter(a => a.status === 'failed').length
    const overallProgress = assigned > 0 ? Math.round((completed / assigned) * 100) : 0

    // 3) Upcoming trainings — attempt verisi zaten include ile geldi
    const upcomingTrainings = eligibleAssignments
      .filter(a => a.status === 'assigned' || a.status === 'in_progress')
      .map(a => {
        const endDate = a.training.endDate
        const daysLeft = endDate
          ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
          : 999

        const latestAttempt = a.examAttempts[0]
        const { percent: progress } = calculateTrainingProgress({
          examOnly: a.training.examOnly === true,
          attemptNumber: latestAttempt?.attemptNumber ?? 0,
          preExamCompleted: latestAttempt?.preExamCompletedAt != null,
          videosCompleted: latestAttempt?.videosCompletedAt != null,
          postExamCompleted: latestAttempt?.postExamCompletedAt != null,
        })

        return {
          id: a.id,
          trainingId: a.training.id,
          title: a.training.title,
          deadline: endDate
            ? new Date(endDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '',
          endDateTime: endDate ? new Date(endDate).toISOString() : null,
          status: a.status,
          daysLeft,
          progress,
          hospitalName: multi ? (a.training.organization?.name ?? null) : null,
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5)

    // 4) Urgent training (closest deadline, <= 7 days)
    const urgentTraining = upcomingTrainings.find(t => t.daysLeft > 0 && t.daysLeft <= 7) ?? null

    // 5) Recent activity
    const recentActivity = recentAttempts.map(a => {
      let text = ''
      let type = 'info'

      if (a.postExamCompletedAt) {
        if (a.isPassed) {
          text = `"${a.training.title}" eğitimini başarıyla tamamladınız (${a.postExamScore}%)`
          type = 'success'
        } else {
          text = `"${a.training.title}" sınavında başarısız oldunuz (${a.postExamScore}%)`
          type = 'error'
        }
      } else if (a.videosCompletedAt) {
        text = `"${a.training.title}" videolarını tamamladınız`
        type = 'success'
      } else if (a.preExamCompletedAt) {
        text = `"${a.training.title}" ön sınavını tamamladınız`
        type = 'info'
      } else {
        text = `"${a.training.title}" eğitimine başladınız`
        type = 'info'
      }

      return {
        text,
        time: formatRelativeTime(a.postExamCompletedAt ?? a.videosCompletedAt ?? a.preExamCompletedAt ?? a.createdAt),
        type,
      }
    })

    const responseData = {
      stats: { assigned, inProgress, completed, failed, overallProgress },
      upcomingTrainings,
      urgentTraining: urgentTraining ? { id: urgentTraining.id, title: urgentTraining.title, daysLeft: urgentTraining.daysLeft } : null,
      notifications: notifications.map(n => ({
        title: n.title,
        time: formatRelativeTime(n.createdAt),
        isRead: n.isRead,
      })),
      recentActivity,
    }

    await setCached(cacheKey, responseData, CACHE_TTL)

    return jsonResponse(responseData, 200, { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' })
  } catch (err) {
    logger.error('Staff Dashboard', 'Dashboard verileri yüklenemedi', err)
    return errorResponse('Dashboard verileri yüklenemedi', 500)
  }
}, { requireOrganization: true })

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Az önce'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`
  return new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}
