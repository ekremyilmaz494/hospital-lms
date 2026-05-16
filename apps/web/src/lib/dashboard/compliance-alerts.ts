/**
 * Admin dashboard "zorunlu eğitim deadline alarmları" —
 * /api/admin/dashboard/stats ve /combined bunu tek noktadan okur.
 */
import { getDeadlineStatus } from '@/lib/deadline-status'

export interface CompulsoryTrainingRow {
  title: string
  complianceDeadline: Date | null
  regulatoryBody: string | null
  assignments: { status: string }[]
}

export interface ComplianceAlert {
  training: string
  regulatoryBody: string
  daysLeft: number
  complianceRate: number
  status: 'ok' | 'warning' | 'critical' | 'overdue'
}

const MAX_ALERTS = 5

export function buildComplianceAlerts(
  compulsory: CompulsoryTrainingRow[],
  now: Date = new Date(),
): ComplianceAlert[] {
  return compulsory
    .filter(t => t.complianceDeadline && new Date(t.complianceDeadline) > now)
    .map(t => {
      const { status, daysLeft } = getDeadlineStatus(t.complianceDeadline, {}, now)
      const totalAssigned = t.assignments.length
      const passed = t.assignments.filter(a => a.status === 'passed').length
      return {
        training: t.title,
        regulatoryBody: t.regulatoryBody ?? '',
        daysLeft: daysLeft ?? 0,
        complianceRate: totalAssigned > 0 ? Math.round((passed / totalAssigned) * 100) : 0,
        status,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, MAX_ALERTS)
}
