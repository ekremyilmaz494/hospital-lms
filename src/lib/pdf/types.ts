/**
 * PDF rapor üretimi için çekirdek tipler.
 * Aggregation katmanı bu yapıyı döndürür, build katmanı tüketir.
 */
import type { FindingRecord } from '@/lib/accreditation'

export interface ReportOrganization {
  id: string
  name: string
  logoUrl: string | null
}

export interface ReportMeta {
  id: string
  title: string
  standardBody: string
  periodStart: Date
  periodEnd: Date
  generatedAt: Date
  overallComplianceRate: number
}

export interface DepartmentComplianceRow {
  department: string
  totalStaff: number
  completedCount: number
  complianceRate: number
}

export interface TrainingGapRow {
  userName: string
  department: string | null
  trainingTitle: string
  dueDate: Date | null
  daysOverdue: number | null
}

export interface ActionPlanRow {
  standardCode: string
  standardTitle: string
  severity: 'non_compliant' | 'at_risk'
  gapPercent: number
  missingStaffCount: number
  recommendation: string
  deadline: Date
}

export interface ReportContext {
  organization: ReportOrganization
  report: ReportMeta
  findings: FindingRecord[]
  departments: DepartmentComplianceRow[]
  trainingGaps: TrainingGapRow[]
  actionPlan: ActionPlanRow[]
  logoDataUrl: string | null
}
