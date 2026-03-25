import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Daily cleanup cron job (Vercel Cron) */
export async function GET(request: Request) {
  // Verify cron secret — block if undefined
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Delete old read notifications (older than 90 days)
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  })

  // 2. Clean up stale exam attempts (stuck in non-completed state for 24h+)
  const staleAttemptsList = await prisma.examAttempt.findMany({
    where: {
      status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true, assignmentId: true },
  })

  if (staleAttemptsList.length > 0) {
    // Mark attempts as expired
    await prisma.examAttempt.updateMany({
      where: { id: { in: staleAttemptsList.map(a => a.id) } },
      data: { status: 'completed' },
    })

    // Update related TrainingAssignment statuses
    const assignmentIds = [...new Set(staleAttemptsList.map(a => a.assignmentId))]
    await prisma.trainingAssignment.updateMany({
      where: { id: { in: assignmentIds }, status: 'in_progress' },
      data: { status: 'assigned' },
    })
  }

  const staleAttempts = { count: staleAttemptsList.length }

  // 3. Delete old audit logs (older than 1 year)
  const deletedLogs = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
  })

  return NextResponse.json({
    success: true,
    deletedNotifications: deletedNotifications.count,
    staleAttemptsClosed: staleAttempts.count,
    deletedLogs: deletedLogs.count,
    timestamp: new Date().toISOString(),
  })
}
