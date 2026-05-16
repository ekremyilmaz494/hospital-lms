/**
 * Akreditasyon raporu için veri toplama.
 *
 * Tek bir fonksiyon — route'tan çağrılır, ReportContext döndürür.
 * Tüm sorgular organizationId ile filtrelenir (multi-tenant izolasyon KRİTİK).
 */

import { prisma } from '@/lib/prisma'
import type { FindingRecord } from '@/lib/accreditation'
import type {
  ReportContext,
  DepartmentComplianceRow,
  TrainingGapRow,
  ActionPlanRow,
} from './types'
import { fetchLogoAsDataUrl } from './helpers/logo'

const MAX_GAPS_IN_REPORT = 50
const GAP_THRESHOLD_DAYS = 14 // Bu süreden eski atamalar "gecikmiş" sayılır

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86400000)
}

/** Bulgu severity'sine göre önerilen aksiyon son tarihi üret. */
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

export async function buildReportContext(
  reportId: string,
  orgId: string
): Promise<ReportContext | null> {
  // 1) Ana rapor + organizasyon
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

  // 2) Departman uyum oranı + eksik eğitim + logo — paralel
  const [departmentGroups, overdueAssignments, logoDataUrl] = await Promise.all([
    // Departman bazlı: her departmanın toplam personel + tamamlanmış atama oranı
    prisma.$queryRaw<Array<{ department: string; total_staff: bigint; completed_count: bigint }>>`
      SELECT
        COALESCE(d.name, 'Atanmamis') AS department,
        COUNT(DISTINCT u.id)::bigint AS total_staff,
        COUNT(DISTINCT CASE WHEN ta.completed_at IS NOT NULL THEN ta.id END)::bigint AS completed_count
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN training_assignments ta ON ta.user_id = u.id
      WHERE u.organization_id = ${orgId}::uuid
        AND u.role = 'staff'
        AND u.is_active = true
      GROUP BY d.name
      ORDER BY total_staff DESC
    `,

    // Eksik eğitim: 14+ gün önce atanmış, hala tamamlanmamış
    prisma.trainingAssignment.findMany({
      where: {
        user: { organizationId: orgId, isActive: true },
        completedAt: null,
        assignedAt: { lte: new Date(Date.now() - GAP_THRESHOLD_DAYS * 86400000) },
      },
      select: {
        assignedAt: true,
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

    // Logo
    fetchLogoAsDataUrl(report.organization.logoUrl),
  ])

  // 3) Departman rows — percent hesapla
  const departments: DepartmentComplianceRow[] = departmentGroups
    .map(g => {
      const totalStaff = Number(g.total_staff)
      const completedCount = Number(g.completed_count)
      const complianceRate = totalStaff > 0
        ? Math.round((completedCount / totalStaff) * 100)
        : 0
      return { department: g.department, totalStaff, completedCount, complianceRate }
    })
    .filter(r => r.totalStaff > 0)

  // 4) Gap rows
  const trainingGaps: TrainingGapRow[] = overdueAssignments.map(a => ({
    userName: `${a.user.firstName} ${a.user.lastName}`.trim(),
    department: a.user.departmentRel?.name ?? null,
    trainingTitle: a.training.title,
    dueDate: a.assignedAt,
    daysOverdue: daysSince(a.assignedAt),
  }))

  // 5) Action plan — findings içinden türet
  const actionPlan: ActionPlanRow[] = findings
    .filter(f => f.status !== 'compliant')
    .sort((a, b) => {
      // non_compliant önce, sonra en büyük gap
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
