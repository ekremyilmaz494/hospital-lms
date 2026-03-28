import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadBuffer, backupKey } from '@/lib/s3'

/** Daily auto-backup cron job — runs at 03:15 UTC (after cleanup at 03:00) */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizations = await prisma.organization.findMany({
    where: { isActive: true, isSuspended: false },
    select: { id: true, name: true },
  })

  const results: Array<{ orgId: string; status: string; sizeMb?: number }> = []

  for (const org of organizations) {
    try {
      const [users, departments, trainings, assignments, attempts, examAnswers, videoProgress, notifications, certificates] = await Promise.all([
        prisma.user.findMany({ where: { organizationId: org.id } }),
        prisma.department.findMany({ where: { organizationId: org.id } }),
        prisma.training.findMany({
          where: { organizationId: org.id },
          include: { videos: true, questions: { include: { options: true } } },
        }),
        prisma.trainingAssignment.findMany({ where: { training: { organizationId: org.id } } }),
        prisma.examAttempt.findMany({ where: { training: { organizationId: org.id } } }),
        prisma.examAnswer.findMany({ where: { attempt: { training: { organizationId: org.id } } } }),
        prisma.videoProgress.findMany({ where: { attempt: { training: { organizationId: org.id } } } }),
        prisma.notification.findMany({ where: { organizationId: org.id } }),
        prisma.certificate.findMany({ where: { training: { organizationId: org.id } } }),
      ])

      const backupData = {
        users,
        departments,
        trainings,
        assignments,
        attempts,
        examAnswers,
        videoProgress,
        notifications,
        certificates,
        exportedAt: new Date().toISOString(),
        organizationId: org.id,
        organizationName: org.name,
      }

      const jsonBlob = JSON.stringify(backupData)
      const buffer = Buffer.from(jsonBlob, 'utf-8')
      const sizeMb = buffer.byteLength / (1024 * 1024)
      const key = backupKey(org.id)

      await uploadBuffer(key, buffer, 'application/json')

      await prisma.dbBackup.create({
        data: {
          organizationId: org.id,
          backupType: 'auto',
          fileUrl: key,
          fileSizeMb: Math.round(sizeMb * 100) / 100,
          status: 'completed',
          createdById: null,
        },
      })

      results.push({ orgId: org.id, status: 'completed', sizeMb: Math.round(sizeMb * 100) / 100 })
    } catch {
      await prisma.dbBackup.create({
        data: {
          organizationId: org.id,
          backupType: 'auto',
          fileUrl: `backups/${org.id}/${Date.now()}.json`,
          fileSizeMb: 0,
          status: 'failed',
          createdById: null,
        },
      }).catch(() => { /* swallow nested error */ })

      results.push({ orgId: org.id, status: 'failed' })
    }
  }

  return NextResponse.json({
    success: true,
    organizationsProcessed: organizations.length,
    results,
    timestamp: new Date().toISOString(),
  })
}
