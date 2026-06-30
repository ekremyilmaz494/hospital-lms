/**
 * Akreditasyon raporu icin veri toplama.
 *
 * Tek bir fonksiyon route'tan cagrilir, ReportContext dondurur.
 * Tum sorgular organizationId ile filtrelenir (multi-tenant izolasyon kritik).
 */

import { prisma } from '@/lib/prisma'
import type { FindingRecord } from '@/lib/accreditation'
import type { UserRole } from '@/types/database'
import type {
  ReportContext,
  DepartmentComplianceRow,
  TrainingGapRow,
  ActionPlanRow,
} from './types'
import { fetchLogoAsDataUrl } from './helpers/logo'

const MAX_GAPS_IN_REPORT = 50
const GAP_THRESHOLD_DAYS = 14

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

function deadlineFor(severity: 'non_compliant' | 'at_risk'): Date {
  const d = new Date()
  d.setDate(d.getDate() + (severity === 'non_compliant' ? 30 : 60))
  return d
}

function recommendationFor(finding: FindingRecord): string {
  if (finding.status === 'non_compliant') {
    return `${finding.missingStaffCount} personel icin oncelikli egitim ve takip planlanmali. Departman yoneticileri ile hedef tarih belirlenmeli.`
  }
  return `Eksik ${finding.missingStaffCount} personel uyum esigine yaklastirilmali. Hatirlatma bildirimi ve mentorluk desteklenmeli.`
}

function findingCategories(findings: FindingRecord[]): string[] {
  return Array.from(new Set(findings.flatMap(f => f.categories).filter(Boolean))).sort()
}

export async function buildReportContext(
  reportId: string,
  orgId: string
): Promise<ReportContext | null> {
  const report = await prisma.accreditationReport.findFirst({
    where: { id: reportId, organizationId: orgId },
    select: {
      id: true,
      title: true,
      standardBody: true,
      periodStart: true,
      periodEnd: true,
      generatedAt: true,
      overallComplianceRate: true,
      findings: true,
      organization: { select: { id: true, name: true, logoUrl: true } },
    },
  })

  if (!report) return null

  const findings = (report.findings as unknown as FindingRecord[]) ?? []
  const categories = findingCategories(findings)
  const cutoffDate = new Date(Math.min(
    report.periodEnd.getTime(),
    Date.now() - GAP_THRESHOLD_DAYS * 86400000,
  ))

  const trainingFilter = categories.length > 0
    ? { organizationId: orgId, category: { in: categories } }
    : { organizationId: orgId }

  const [staffRows, overdueAssignments, logoDataUrl] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' satisfies UserRole, isActive: true },
      select: {
        id: true,
        departmentRel: { select: { name: true } },
        assignments: {
          where: {
            status: 'passed',
            completedAt: { gte: report.periodStart, lte: report.periodEnd },
            training: trainingFilter,
          },
          select: { id: true },
        },
      },
    }),

    prisma.trainingAssignment.findMany({
      where: {
        user: { organizationId: orgId, isActive: true },
        completedAt: null,
        assignedAt: { gte: report.periodStart, lte: cutoffDate },
        training: trainingFilter,
      },
      select: {
        assignedAt: true,
        dueDate: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
        training: { select: { title: true } },
      },
      orderBy: { assignedAt: 'asc' },
      take: MAX_GAPS_IN_REPORT,
    }),

    fetchLogoAsDataUrl(report.organization.logoUrl),
  ])

  const departmentsMap = new Map<string, { totalStaff: number; completedCount: number }>()
  for (const staff of staffRows) {
    const department = staff.departmentRel?.name ?? 'Atanmamis'
    const current = departmentsMap.get(department) ?? { totalStaff: 0, completedCount: 0 }
    current.totalStaff += 1
    if (staff.assignments.length > 0) current.completedCount += 1
    departmentsMap.set(department, current)
  }

  const departments: DepartmentComplianceRow[] = Array.from(departmentsMap.entries())
    .map(([department, row]) => ({
      department,
      totalStaff: row.totalStaff,
      completedCount: row.completedCount,
      complianceRate: row.totalStaff > 0 ? Math.round((row.completedCount / row.totalStaff) * 100) : 0,
    }))
    .sort((a, b) => b.totalStaff - a.totalStaff)

  const trainingGaps: TrainingGapRow[] = overdueAssignments.map(a => ({
    userName: `${a.user.firstName} ${a.user.lastName}`.trim(),
    department: a.user.departmentRel?.name ?? null,
    trainingTitle: a.training.title,
    dueDate: a.dueDate ?? a.assignedAt,
    daysOverdue: daysSince(a.dueDate ?? a.assignedAt),
  }))

  const actionPlan: ActionPlanRow[] = findings
    .filter(f => f.status !== 'compliant')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'non_compliant' ? -1 : 1
      return (b.requiredRate - b.actualRate) - (a.requiredRate - a.actualRate)
    })
    .map(f => ({
      standardCode: f.standardCode,
      standardTitle: f.standardTitle,
      severity: f.status as 'non_compliant' | 'at_risk',
      gapPercent: Math.max(0, f.requiredRate - f.actualRate),
      missingStaffCount: f.missingStaffCount,
      recommendation: recommendationFor(f),
      deadline: deadlineFor(f.status as 'non_compliant' | 'at_risk'),
    }))

  return {
    organization: {
      id: report.organization.id,
      name: report.organization.name,
      logoUrl: report.organization.logoUrl,
    },
    report: {
      id: report.id,
      title: report.title,
      standardBody: report.standardBody,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      generatedAt: report.generatedAt,
      overallComplianceRate: Number(report.overallComplianceRate),
    },
    findings,
    departments,
    trainingGaps,
    actionPlan,
    logoDataUrl,
  }
}