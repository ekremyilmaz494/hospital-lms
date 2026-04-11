import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { jsPDF } from 'jspdf'
import type { FindingRecord } from '@/lib/accreditation'

const BODY_LABELS: Record<string, string> = {
  JCI: 'JCI Akreditasyonu',
  ISO_9001: 'ISO 9001 Kalite Yonetimi',
  ISO_15189: 'ISO 15189 Laboratuvar',
  TJC: 'The Joint Commission',
  OSHA: 'OSHA Is Guvenligi',
}

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Uyumlu',
  at_risk: 'Risk Altinda',
  non_compliant: 'Uyumsuz',
}

/** GET /api/admin/accreditation/reports/[id]/pdf */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params
  const orgId = dbUser!.organizationId!

  const report = await prisma.accreditationReport.findFirst({
    where: { id, organizationId: orgId },
    include: { organization: { select: { name: true } } },
  })

  if (!report) return errorResponse('Rapor bulunamadı', 404)

  const findings = report.findings as unknown as FindingRecord[]
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // --- Header ---
  doc.setFontSize(18)
  doc.setTextColor(13, 150, 104)
  doc.text('Devakent Hastanesi - Akreditasyon Raporu', pageWidth / 2, 18, { align: 'center' })

  doc.setFontSize(11)
  doc.setTextColor(80)
  doc.text(report.organization.name, pageWidth / 2, 27, { align: 'center' })
  doc.text(BODY_LABELS[report.standardBody] ?? report.standardBody, pageWidth / 2, 34, { align: 'center' })

  doc.setFontSize(9)
  doc.text(
    `Donem: ${new Date(report.periodStart).toLocaleDateString('tr-TR')} - ${new Date(report.periodEnd).toLocaleDateString('tr-TR')}`,
    pageWidth / 2, 40, { align: 'center' }
  )
  doc.text(
    `Rapor Tarihi: ${new Date(report.generatedAt).toLocaleDateString('tr-TR')}`,
    pageWidth / 2, 46, { align: 'center' }
  )

  doc.setDrawColor(13, 150, 104)
  doc.line(20, 50, pageWidth - 20, 50)

  // --- Overall score ---
  const rate = Number(report.overallComplianceRate)
  doc.setFontSize(24)
  doc.setTextColor(rate >= 80 ? 22 : rate >= 60 ? 217 : 220, rate >= 80 ? 163 : rate >= 60 ? 119 : 38, rate >= 80 ? 74 : rate >= 60 ? 6 : 38)
  doc.text(`%${rate}`, pageWidth / 2, 65, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text('Genel Uyumluluk Orani', pageWidth / 2, 72, { align: 'center' })

  // --- Summary counts ---
  const compliant = findings.filter(f => f.status === 'compliant').length
  const atRisk = findings.filter(f => f.status === 'at_risk').length
  const nonCompliant = findings.filter(f => f.status === 'non_compliant').length

  doc.setFontSize(9)
  doc.setTextColor(22, 163, 74)
  doc.text(`Uyumlu: ${compliant}`, 30, 82)
  doc.setTextColor(217, 119, 6)
  doc.text(`Risk Altinda: ${atRisk}`, 80, 82)
  doc.setTextColor(220, 38, 38)
  doc.text(`Uyumsuz: ${nonCompliant}`, 140, 82)

  doc.setDrawColor(200)
  doc.line(20, 86, pageWidth - 20, 86)

  // --- Findings table ---
  doc.setFontSize(11)
  doc.setTextColor(30)
  doc.text('Standart Bulgulari', 20, 94)

  // Table header
  let y = 100
  doc.setFontSize(8)
  doc.setFillColor(13, 150, 104)
  doc.setTextColor(255)
  doc.rect(20, y - 4, pageWidth - 40, 7, 'F')
  doc.text('Kod', 22, y)
  doc.text('Standart', 50, y)
  doc.text('Gereken%', 135, y)
  doc.text('Gercek%', 155, y)
  doc.text('Durum', 175, y)
  y += 8

  doc.setTextColor(50)
  for (const f of findings) {
    if (y > 275) { doc.addPage(); y = 20 }

    // Row background for non-compliant
    if (f.status === 'non_compliant') {
      doc.setFillColor(254, 242, 242)
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F')
    } else if (f.status === 'at_risk') {
      doc.setFillColor(255, 251, 235)
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F')
    }

    doc.setFontSize(7.5)
    doc.setTextColor(60)
    doc.text(f.standardCode, 22, y)
    // Truncate title to fit
    const title = f.standardTitle.length > 42 ? f.standardTitle.substring(0, 42) + '...' : f.standardTitle
    doc.text(title, 50, y)
    doc.text(`${f.requiredRate}%`, 137, y)
    doc.text(`${f.actualRate}%`, 157, y)

    const statusLabel = STATUS_LABELS[f.status] ?? f.status
    if (f.status === 'compliant') doc.setTextColor(22, 163, 74)
    else if (f.status === 'at_risk') doc.setTextColor(217, 119, 6)
    else doc.setTextColor(220, 38, 38)
    doc.text(statusLabel, 175, y)
    doc.setTextColor(60)

    y += 8
  }

  // --- Non-compliant detail section ---
  const nonCompliantFindings = findings.filter(f => f.status !== 'compliant')
  if (nonCompliantFindings.length > 0) {
    if (y > 240) { doc.addPage(); y = 20 }
    y += 6
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 8

    doc.setFontSize(11)
    doc.setTextColor(30)
    doc.text('Aksiyon Gerektiren Standartlar', 20, y)
    y += 8

    for (const f of nonCompliantFindings) {
      if (y > 270) { doc.addPage(); y = 20 }

      doc.setFontSize(9)
      if (f.status === 'non_compliant') doc.setTextColor(220, 38, 38)
      else doc.setTextColor(217, 119, 6)
      doc.text(`${f.standardCode} — ${f.standardTitle}`, 20, y)
      y += 6

      doc.setFontSize(8)
      doc.setTextColor(80)
      doc.text(
        `Eksik personel: ${f.missingStaffCount} kisi | Gerceklesen: %${f.actualRate} (hedef: %${f.requiredRate})`,
        25, y
      )
      y += 8
    }
  }

  // --- Footer ---
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Sayfa ${i} / ${totalPages}`, pageWidth / 2, 290, { align: 'center' })
    doc.text('Devakent Hastanesi — Gizli', 20, 290)
  }

  const pdfBuffer = doc.output('arraybuffer')
  const safeTitle = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${safeTitle}.pdf`,
      'Cache-Control': 'private, no-store',
    },
  })
}
