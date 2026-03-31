/**
 * Akreditasyon Raporu Servisi
 *
 * JCI, ISO 9001, ISO 15189, TJC ve OSHA standartlarına göre
 * organizasyonun uyumluluk durumunu hesaplar ve rapor oluşturur.
 */
import { prisma } from '@/lib/prisma'

export type StandardBody = 'JCI' | 'ISO_9001' | 'ISO_15189' | 'TJC' | 'OSHA'

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

export interface AccreditationReportData {
  reportId: string
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

/** Uyumluluk durumunu hesapla */
function calcStatus(actual: number, required: number): FindingRecord['status'] {
  if (actual >= required) return 'compliant'
  if (actual >= required * 0.8) return 'at_risk'
  return 'non_compliant'
}

/**
 * Akreditasyon raporu oluştur ve DB'ye kaydet.
 */
export async function generateAccreditationReport(params: {
  organizationId: string
  standardBody: StandardBody
  periodStart: Date
  periodEnd: Date
  generatedBy: string
}): Promise<AccreditationReportData> {
  const { organizationId, standardBody, periodStart, periodEnd, generatedBy } = params

  // a) Bu standart için aktif standartları getir
  const standards = await prisma.accreditationStandard.findMany({
    where: { standardBody, isActive: true },
    orderBy: { code: 'asc' },
  })

  // b) Organizasyondaki toplam aktif personel sayısı
  const totalStaff = await prisma.user.count({
    where: { organizationId, role: 'staff', isActive: true },
  })

  // c) Her standart için uyumluluk hesapla
  const findings: FindingRecord[] = []

  for (const std of standards) {
    const categories = std.requiredTrainingCategories as string[]

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

    // Bu kategorilerdeki eğitimleri dönem içinde tamamlamış personel (her kategoriden en az biri)
    // Her kategoride tamamlama yapan personel kümesini kesişimle bul
    let completedStaffIds: string[] | null = null

    for (const category of categories) {
      // Bu kategoride dönem içinde tamamlanmış assignment'ı olan personel
      const staffInCategory = await prisma.trainingAssignment.findMany({
        where: {
          status: 'passed',
          completedAt: { gte: periodStart, lte: periodEnd },
          user: { organizationId, role: 'staff', isActive: true },
          training: { organizationId, category },
        },
        select: { userId: true },
        distinct: ['userId'],
      })

      const ids = staffInCategory.map(r => r.userId)

      if (completedStaffIds === null) {
        completedStaffIds = ids
      } else {
        // Kesişim: her iki listede de olan personel
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

  // d) Genel uyumluluk oranı = compliant standart / toplam standart
  const compliantCount = findings.filter(f => f.status === 'compliant').length
  const atRiskCount = findings.filter(f => f.status === 'at_risk').length
  const nonCompliantCount = findings.filter(f => f.status === 'non_compliant').length
  const overallComplianceRate = findings.length > 0
    ? Math.round((compliantCount / findings.length) * 100)
    : 0

  const standardBodyLabels: Record<string, string> = {
    JCI: 'JCI Akreditasyonu',
    ISO_9001: 'ISO 9001 Kalite Yönetimi',
    ISO_15189: 'ISO 15189 Laboratuvar',
    TJC: 'The Joint Commission',
    OSHA: 'OSHA İş Güvenliği',
  }

  // e) AccreditationReport tablosuna kaydet
  const report = await prisma.accreditationReport.create({
    data: {
      organizationId,
      title: `${standardBodyLabels[standardBody] ?? standardBody} Denetim Raporu`,
      standardBody,
      generatedBy,
      periodStart,
      periodEnd,
      overallComplianceRate,
      findings: findings as object[],
    },
  })

  return {
    reportId: report.id,
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

/** Mevcut uyumluluk durumunu hesapla (rapor kaydetmeden, son 12 ay) */
export async function getCurrentCompliance(params: {
  organizationId: string
  standardBody: StandardBody
}): Promise<Omit<AccreditationReportData, 'reportId' | 'generatedBy'>> {
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd)
  periodStart.setFullYear(periodStart.getFullYear() - 1)

  const fakeGeneratedBy = 'system'
  const result = await generateAccreditationReport({
    ...params,
    periodStart,
    periodEnd,
    generatedBy: fakeGeneratedBy,
  })

  // Kaydedilen raporu sil (bu sadece önizleme)
  await prisma.accreditationReport.delete({ where: { id: result.reportId } })

  return result
}
