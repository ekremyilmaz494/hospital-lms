import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, complianceReportEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

/** Monthly compliance report cron — runs at 08:00 UTC on the 1st of every month (11:00 Istanbul) */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is required')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let emailsSent = 0
  let emailsFailed = 0
  const orgResults: { orgId: string; orgName: string; complianceRate: number; warningEmails: number }[] = []

  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  for (const org of organizations) {
    const trainings = await prisma.training.findMany({
      where: { organizationId: org.id, isCompulsory: true, isActive: true },
      include: { assignments: { select: { status: true } } },
    })

    const totalAssignments = trainings.reduce((sum, t) => sum + t.assignments.length, 0)
    const passedAssignments = trainings.reduce(
      (sum, t) => sum + t.assignments.filter((a) => a.status === 'passed').length,
      0,
    )

    const complianceRate = totalAssignments > 0 ? Math.round((passedAssignments / totalAssignments) * 100) : 100

    // Kritik uyari sayisi: %60 altinda olan zorunlu egitimlerin sayisi
    const criticalCount = trainings.filter((t) => {
      const total = t.assignments.length
      if (total === 0) return false
      const passed = t.assignments.filter((a) => a.status === 'passed').length
      return (passed / total) * 100 < 60
    }).length

    const orgResult = { orgId: org.id, orgName: org.name, complianceRate, warningEmails: 0 }

    if (complianceRate < 80) {
      const admins = await prisma.user.findMany({
        where: { organizationId: org.id, role: 'admin', isActive: true },
        select: { email: true },
      })

      const detailUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/reports`

      for (const admin of admins) {
        try {
          await sendEmail({
            to: admin.email,
            subject: `Aylik Uyum Raporu — ${org.name} (%${complianceRate})`,
            html: complianceReportEmail(org.name, complianceRate, criticalCount, detailUrl),
          })
          emailsSent++
          orgResult.warningEmails++
        } catch (err) {
          emailsFailed++
          logger.error('Cron ComplianceReport', `Email gonderilemedi: ${admin.email}`, (err as Error).message)
        }
      }
    }

    orgResults.push(orgResult)
  }

  logger.info('Cron ComplianceReport', 'Aylik uyum raporu cron tamamlandi', {
    totalOrgs: organizations.length,
    emailsSent,
    emailsFailed,
  })

  return NextResponse.json({
    success: true,
    totalOrgs: organizations.length,
    emailsSent,
    emailsFailed,
    orgResults,
    timestamp: new Date().toISOString(),
  })
}
