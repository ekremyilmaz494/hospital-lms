import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

// GET /api/staff/dashboard — Personel dashboard verileri
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  const userId = dbUser!.id

  try {
    // 1) Assignment stats
    const assignments = await prisma.trainingAssignment.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        trainingId: true,
        completedAt: true,
        training: {
          select: {
            id: true,
            title: true,
            endDate: true,
          },
        },
      },
    })

    const assigned = assignments.length
    const inProgress = assignments.filter(a => a.status === 'in_progress').length
    const completed = assignments.filter(a => a.status === 'passed').length
    const failed = assignments.filter(a => a.status === 'failed').length
    const overallProgress = assigned > 0 ? Math.round((completed / assigned) * 100) : 0

    // 2) Upcoming trainings (assigned or in_progress, with deadline)
    const activeAssignments = assignments.filter(
      a => a.status === 'assigned' || a.status === 'in_progress'
    )

    // Get progress info for active assignments
    const assignmentIds = activeAssignments.map(a => a.id)
    const attempts = assignmentIds.length > 0
      ? await prisma.examAttempt.findMany({
          where: { assignmentId: { in: assignmentIds } },
          select: {
            assignmentId: true,
            videosCompletedAt: true,
            preExamCompletedAt: true,
            postExamCompletedAt: true,
          },
          orderBy: { attemptNumber: 'desc' },
        })
      : []

    const upcomingTrainings = activeAssignments
      .map(a => {
        const endDate = a.training.endDate
        const daysLeft = endDate
          ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
          : 999

        // Estimate progress from latest attempt
        const latestAttempt = attempts.find(att => att.assignmentId === a.id)
        let progress = 0
        if (latestAttempt) {
          if (latestAttempt.postExamCompletedAt) progress = 100
          else if (latestAttempt.videosCompletedAt) progress = 75
          else if (latestAttempt.preExamCompletedAt) progress = 25
          else progress = 10
        }

        return {
          id: a.id,
          trainingId: a.training.id,
          title: a.training.title,
          deadline: endDate
            ? new Date(endDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '',
          status: a.status,
          daysLeft,
          progress,
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5)

    // 3) Urgent training (closest deadline, <= 7 days)
    const urgentTraining = upcomingTrainings.find(t => t.daysLeft > 0 && t.daysLeft <= 7) ?? null

    // 4) Recent notifications
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        title: true,
        isRead: true,
        createdAt: true,
      },
    })

    // 5) Recent activity from exam attempts
    const recentAttempts = await prisma.examAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        status: true,
        isPassed: true,
        postExamScore: true,
        preExamCompletedAt: true,
        videosCompletedAt: true,
        postExamCompletedAt: true,
        createdAt: true,
        training: { select: { title: true } },
      },
    })

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

    return jsonResponse({
      stats: { assigned, inProgress, completed, failed, overallProgress },
      upcomingTrainings,
      urgentTraining: urgentTraining ? { id: urgentTraining.id, title: urgentTraining.title, daysLeft: urgentTraining.daysLeft } : null,
      notifications: notifications.map(n => ({
        title: n.title,
        time: formatRelativeTime(n.createdAt),
        isRead: n.isRead,
      })),
      recentActivity,
    })
  } catch (err) {
    logger.error('Staff Dashboard', 'Dashboard verileri yüklenemedi', err)
    return errorResponse('Dashboard verileri yüklenemedi', 500)
  }
}

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
