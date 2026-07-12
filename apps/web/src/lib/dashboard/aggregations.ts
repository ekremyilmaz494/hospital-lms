/**
 * Dashboard KPI agregasyonları — hastane (org) başına ham sayılar.
 *
 * `fetchOrgKpis(orgId)` tek bir hastanenin çekirdek KPI'larını hesaplar (period-duyarlı,
 * admin dashboard ile AYNI filtreler). Admin dashboard bunu UI-şekilli stat kartlarına
 * dönüştürür (`admin/dashboard/combined/route.ts` fetchStats); grup konsolide paneli ise
 * ham sayıları hastaneler arası toplar (`api/group/dashboard/route.ts`). TEK kaynak →
 * grup rakamları hastane panelleriyle birebir tutarlı kalır.
 *
 * Cache YOK (saf hesap) — çağıran kendi seviyesinde cache'ler (admin: dashboard:stats:{orgId},
 * grup: group:dashboard:{groupId}).
 */
import { prisma } from '@/lib/prisma'
import { findActivePeriod } from '@/lib/training-periods'
import { complianceAlertStatus } from '@/lib/compliance-alert'
import { orgStaffWhere, withOrgStaffScope } from '@/lib/org-scope'

export interface OrgComplianceAlert {
  training: string
  regulatoryBody: string
  daysLeft: number
  complianceRate: number
  status: ReturnType<typeof complianceAlertStatus>
}

export interface OrgStatusSlice {
  name: string
  value: number
  color: string
}

export interface OrgKpis {
  staffCount: number
  activeStaffCount: number
  publishedTrainingCount: number
  activeTrainingCount: number
  totalAssignments: number
  completedCount: number
  failedCount: number
  inProgressCount: number
  assignedPendingCount: number
  completionRate: number
  overdueCount: number
  hasCompliance: boolean
  complianceRate: number
  compulsoryTrainingCount: number
  /** Zorunlu eğitim atama sayısı — grup seviyesinde AĞIRLIKLI uyum roll-up'ı için. */
  compulsoryAssignmentCount: number
  compulsoryCompletedCount: number
  complianceAlerts: OrgComplianceAlert[]
  statusDistribution: OrgStatusSlice[]
}

/**
 * Bir hastanenin çekirdek KPI'larını hesaplar. Aktif training period varsa atama
 * agregasyonları o döneme scope'lanır (yoksa scope açık — geri uyumluluk).
 */
export async function fetchOrgKpis(orgId: string): Promise<OrgKpis> {
  const trainingScope = { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } }

  const activePeriod = await findActivePeriod(orgId)
  const periodFilter: Record<string, unknown> = activePeriod ? { periodId: activePeriod.id } : {}

  const [
    staffCount,
    activeStaffCount,
    publishedTrainingCount,
    activeTrainingCount,
    statusCounts,
    compulsoryTrainings,
    compulsoryStatusCounts,
    overdueCount,
  ] = await Promise.all([
    prisma.user.count({ where: orgStaffWhere(orgId) }), // ortak personel: üyelikli doktoru da say
    prisma.user.count({ where: withOrgStaffScope(orgId, { isActive: true }) }),
    prisma.training.count({ where: { ...trainingScope, publishStatus: 'published' } }),
    prisma.training.count({ where: trainingScope }),
    prisma.trainingAssignment.groupBy({ by: ['status'], where: { training: trainingScope, ...periodFilter }, _count: true }),
    prisma.training.findMany({
      where: { ...trainingScope, isCompulsory: true },
      select: { id: true, title: true, complianceDeadline: true, regulatoryBody: true },
    }),
    prisma.trainingAssignment.groupBy({
      by: ['trainingId', 'status'],
      where: { training: { ...trainingScope, isCompulsory: true }, ...periodFilter },
      _count: true,
    }),
    prisma.trainingAssignment.count({
      where: {
        ...periodFilter,
        status: { notIn: ['passed', 'failed'] },
        OR: [
          { dueDate: { lt: new Date() }, training: trainingScope },
          { dueDate: null, training: { ...trainingScope, endDate: { lt: new Date() } } },
        ],
      },
    }),
  ])

  const now = new Date()
  const statusMap = new Map(statusCounts.map(s => [s.status, s._count]))
  const completedCount = statusMap.get('passed') ?? 0
  const failedCount = statusMap.get('failed') ?? 0
  const inProgressCount = statusMap.get('in_progress') ?? 0
  const assignedPendingCount = statusMap.get('assigned') ?? 0
  const totalAssignments = statusCounts.reduce((sum, s) => sum + s._count, 0)
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0

  const compulsoryTotalsByTraining = new Map<string, { total: number; passed: number }>()
  for (const row of compulsoryStatusCounts) {
    const entry = compulsoryTotalsByTraining.get(row.trainingId) ?? { total: 0, passed: 0 }
    entry.total += row._count
    if (row.status === 'passed') entry.passed += row._count
    compulsoryTotalsByTraining.set(row.trainingId, entry)
  }
  let compulsoryAssignmentCount = 0
  let compulsoryCompletedCount = 0
  for (const t of compulsoryTotalsByTraining.values()) {
    compulsoryAssignmentCount += t.total
    compulsoryCompletedCount += t.passed
  }
  const hasCompliance = compulsoryAssignmentCount > 0
  const complianceRate = hasCompliance ? Math.round((compulsoryCompletedCount / compulsoryAssignmentCount) * 100) : 0

  const complianceAlerts: OrgComplianceAlert[] = compulsoryTrainings
    .filter(t => t.complianceDeadline)
    .map(t => {
      const daysLeft = Math.ceil((new Date(t.complianceDeadline!).getTime() - now.getTime()) / 86400000)
      const totals = compulsoryTotalsByTraining.get(t.id) ?? { total: 0, passed: 0 }
      return {
        training: t.title,
        regulatoryBody: t.regulatoryBody ?? '',
        daysLeft,
        complianceRate: totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : 0,
        status: complianceAlertStatus(daysLeft),
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)

  const statusDistribution: OrgStatusSlice[] = [
    { name: 'Tamamlanan', value: completedCount, color: 'var(--color-success)' },
    { name: 'Devam Eden', value: inProgressCount, color: 'var(--color-info)' },
    { name: 'Başarısız', value: failedCount, color: 'var(--color-error)' },
    { name: 'Bekleyen', value: assignedPendingCount, color: 'var(--color-warning)' },
  ]

  return {
    staffCount,
    activeStaffCount,
    publishedTrainingCount,
    activeTrainingCount,
    totalAssignments,
    completedCount,
    failedCount,
    inProgressCount,
    assignedPendingCount,
    completionRate,
    overdueCount,
    hasCompliance,
    complianceRate,
    compulsoryTrainingCount: compulsoryTrainings.length,
    compulsoryAssignmentCount,
    compulsoryCompletedCount,
    complianceAlerts,
    statusDistribution,
  }
}
