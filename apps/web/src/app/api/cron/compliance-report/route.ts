import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, complianceReportEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { maskEmail } from '@/lib/pii-mask'
import type { UserRole } from '@/types/database'
import { findActivePeriod } from '@/lib/training-periods'
import { assertCronAuth } from '@/lib/cron-auth'
import { isBusinessCronAllowed } from '@/lib/license/enforcement'

/** Monthly compliance report cron — runs at 08:00 UTC on the 1st of every month (11:00 Istanbul) */
export async function GET(request: Request) {
  const authErr = assertCronAuth(request)
  if (authErr) return authErr

  // On-prem: READONLY/LOCKED'ta iş cron'ları atlanır (yalnız altyapı cron'ları çalışır). Bulutta no-op.
  if (!(await isBusinessCronAllowed())) {
    return NextResponse.json({ ok: true, skipped: 'license' }, { headers: { 'Cache-Control': 'no-store' } })
  }

  let emailsSent = 0
  let emailsFailed = 0
  const orgResults: { orgId: string; orgName: string; complianceRate: number; warningEmails: number }[] = []

  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  for (const org of organizations) {
    // Aktif period yoksa bu org için compliance hesaplamayı atla
    const activePeriod = await findActivePeriod(org.id)
    if (!activePeriod) {
      orgResults.push({ orgId: org.id, orgName: org.name, complianceRate: 100, warningEmails: 0 })
      continue
    }

    const trainings = await prisma.training.findMany({
      where: { organizationId: org.id, isCompulsory: true, isActive: true },
      select: {
        id: true,
        assignments: {
          where: { periodId: activePeriod.id },
          select: { status: true },
        },
      },
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
        where: { organizationId: org.id, role: 'admin' satisfies UserRole, isActive: true },
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
          logger.error('Cron ComplianceReport', `Email gonderilemedi: ${maskEmail(admin.email)}`, (err as Error).message)
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
  }, { headers: { 'Cache-Control': 'no-store' } })
}
