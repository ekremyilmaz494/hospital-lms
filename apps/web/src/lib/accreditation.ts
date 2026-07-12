/**
 * Akreditasyon / denetim raporu servisi.
 *
 * JCI, ISO 9001, ISO 15189, TJC, OSHA ve SKS standartlarina gore
 * organizasyonun egitim uyumlulugunu hesaplar ve rapor olusturur.
 */
import { prisma } from '@/lib/prisma'
import { withOrgStaffScope } from '@/lib/org-scope'

export const VALID_STANDARD_BODIES = ['JCI', 'ISO_9001', 'ISO_15189', 'TJC', 'OSHA', 'SKS'] as const
export type StandardBody = typeof VALID_STANDARD_BODIES[number]

export interface FindingRecord {
  standardCode: string
  standardTitle: string
  requiredRate: number
  actualRate: number
  missingStaffCount: number
  totalStaff: number
  categories: string[]
  status: 'compliant' | 'at_risk' | 'non_compliant'
}

export interface AccreditationComplianceData {
  organizationId: string
  standardBody: StandardBody
  periodStart: Date
  periodEnd: Date
  overallComplianceRate: number
  findings: FindingRecord[]
  compliantCount: number
  atRiskCount: number
  nonCompliantCount: number
}

export interface AccreditationReportData extends AccreditationComplianceData {
  reportId: string
}

/** Uyumluluk durumunu hesapla */
function calcStatus(actual: number, required: number): FindingRecord['status'] {
  if (actual >= required) return 'compliant'
  if (actual >= required * 0.8) return 'at_risk'
  return 'non_compliant'
}

function normalizeCategories(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : []
}

/**
 * Uyumluluk durumunu hesaplar; DB'ye rapor yazmaz.
 * Simulasyon ve rapor kaydetme ayni hesap motorunu kullanir.
 */
export async function calculateAccreditationCompliance(params: {
  organizationId: string
  standardBody: StandardBody
  periodStart: Date
  periodEnd: Date
}): Promise<AccreditationComplianceData> {
  const { organizationId, standardBody, periodStart, periodEnd } = params

  const standards = await prisma.accreditationStandard.findMany({
    where: {
      standardBody,
      isActive: true,
      OR: [
        { organizationId: null },
        { organizationId },
      ],
    },
    orderBy: { code: 'asc' },
  })

  const totalStaff = await prisma.user.count({
    where: withOrgStaffScope(organizationId, { isActive: true }), // ortak personel: paydaya üyelikli doktoru da kat
  })

  const findings: FindingRecord[] = []

  for (const std of standards) {
    const categories = normalizeCategories(std.requiredTrainingCategories)

    if (categories.length === 0) {
      findings.push({
        standardCode: std.code,
        standardTitle: std.title,
        requiredRate: std.requiredCompletionRate,
        actualRate: 100,
        missingStaffCount: 0,
        totalStaff,
        categories,
        status: 'compliant',
      })
      continue
    }

    // Her kategori icin en az bir basarili tamamlama yapan personel kumesini kesisimle bul.
    let completedStaffIds: string[] | null = null

    for (const category of categories) {
      const staffInCategory = await prisma.trainingAssignment.findMany({
        where: {
          status: 'passed',
          completedAt: { gte: periodStart, lte: periodEnd },
          user: withOrgStaffScope(organizationId, { isActive: true }), // pay: üyelikli doktorun B tamamlaması da sayılır
          training: { organizationId, category }, // payda-eğitim B'ye izole (ortak doktorun A eğitimi karışmaz)
        },
        select: { userId: true },
        distinct: ['userId'],
      })

      const ids = staffInCategory.map(r => r.userId)

      if (completedStaffIds === null) {
        completedStaffIds = ids
      } else {
        const idSet = new Set(ids)
        completedStaffIds = completedStaffIds.filter(id => idSet.has(id))
      }
    }

    const completedCount = completedStaffIds?.length ?? 0
    const actualRate = totalStaff > 0
      ? Math.round((completedCount / totalStaff) * 100)
      : 0
    const missingStaffCount = Math.max(0, totalStaff - completedCount)

    findings.push({
      standardCode: std.code,
      standardTitle: std.title,
      requiredRate: std.requiredCompletionRate,
      actualRate,
      missingStaffCount,
      totalStaff,
      categories,
      status: calcStatus(actualRate, std.requiredCompletionRate),
    })
  }

  const compliantCount = findings.filter(f => f.status === 'compliant').length
  const atRiskCount = findings.filter(f => f.status === 'at_risk').length
  const nonCompliantCount = findings.filter(f => f.status === 'non_compliant').length
  const overallComplianceRate = findings.length > 0
    ? Math.round((compliantCount / findings.length) * 100)
    : 0

  return {
    organizationId,
    standardBody,
    periodStart,
    periodEnd,
    overallComplianceRate,
    findings,
    compliantCount,
    atRiskCount,
    nonCompliantCount,
  }
}

/**
 * Akreditasyon raporu olustur ve DB'ye kaydet.
 */
export async function generateAccreditationReport(params: {
  organizationId: string
  standardBody: StandardBody
  periodStart: Date
  periodEnd: Date
  generatedBy: string
}): Promise<AccreditationReportData> {
  const { organizationId, standardBody, periodStart, periodEnd, generatedBy } = params

  const compliance = await calculateAccreditationCompliance({
    organizationId,
    standardBody,
    periodStart,
    periodEnd,
  })

  const standardBodyLabels: Record<StandardBody, string> = {
    JCI: 'JCI Akreditasyonu',
    ISO_9001: 'ISO 9001 Kalite Yonetimi',
    ISO_15189: 'ISO 15189 Laboratuvar',
    TJC: 'The Joint Commission',
    OSHA: 'OSHA Is Guvenligi',
    SKS: 'SKS Saglikta Kalite Standartlari',
  }

  const report = await prisma.accreditationReport.create({
    data: {
      organizationId,
      title: `${standardBodyLabels[standardBody] ?? standardBody} Denetim Raporu`,
      standardBody,
      generatedBy,
      periodStart,
      periodEnd,
      overallComplianceRate: compliance.overallComplianceRate,
      findings: compliance.findings as object[],
    },
  })

  return {
    reportId: report.id,
    ...compliance,
  }
}

/** Mevcut uyumluluk durumunu hesapla; rapor kaydetmez. */
export async function getCurrentCompliance(params: {
  organizationId: string
  standardBody: StandardBody
  requestedBy: string
  periodStart?: Date
  periodEnd?: Date
}): Promise<AccreditationComplianceData> {
  const periodEnd = params.periodEnd ?? new Date()
  const periodStart = params.periodStart ?? new Date(periodEnd)
  if (!params.periodStart) periodStart.setFullYear(periodStart.getFullYear() - 1)

  void params.requestedBy

  return calculateAccreditationCompliance({
    organizationId: params.organizationId,
    standardBody: params.standardBody,
    periodStart,
    periodEnd,
  })
}
