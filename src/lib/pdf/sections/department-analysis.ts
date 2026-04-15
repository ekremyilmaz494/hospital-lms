/**
 * Departman bazlı uyum analizi — tablo + inline bar grafik.
 */
import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, SPACING } from '../theme'
import { tr } from '../helpers/text'

export function renderDepartmentAnalysis(doc: jsPDF, ctx: ReportContext, startY: number): number {
  const marginX = SPACING.pageMarginX

  doc.setFontSize(FONT_SIZES.sectionTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr('3. Departman Bazli Uyum'), marginX, startY)

  if (ctx.departments.length === 0) {
    doc.setFontSize(FONT_SIZES.body)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(tr('Departman verisi bulunmamaktadir.'), marginX, startY + 8)
    return startY + 14
  }

  const rows = ctx.departments.map(d => [
    tr(d.department),
    String(d.totalStaff),
    String(d.completedCount),
    `%${d.complianceRate}`,
    '', // Bar cell — didDrawCell ile çizilecek
  ])

  autoTable(doc, {
    startY: startY + 4,
    head: [[tr('Departman'), tr('Personel'), tr('Tamamlayan'), tr('Uyum'), tr('Gorsel')]],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontSize: FONT_SIZES.small,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: FONT_SIZES.small,
      textColor: COLORS.textDark,
      cellPadding: 2.5,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: COLORS.surfaceAlt },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 55 },
    },
    margin: { left: marginX, right: marginX, top: 14, bottom: 16 },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== 4) return
      const dept = ctx.departments[data.row.index]
      if (!dept) return

      const rate = dept.complianceRate
      const color = rate >= 80 ? COLORS.success : rate >= 60 ? COLORS.warning : COLORS.danger

      const padding = 2
      const barX = data.cell.x + padding
      const barY = data.cell.y + data.cell.height / 2 - 1.5
      const maxBarW = data.cell.width - padding * 2
      const barW = Math.max(0.5, (rate / 100) * maxBarW)

      // Background
      doc.setFillColor(...COLORS.border)
      doc.rect(barX, barY, maxBarW, 3, 'F')

      // Fill
      doc.setFillColor(...color)
      doc.rect(barX, barY, barW, 3, 'F')
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 3) {
        const dept = ctx.departments[data.row.index]
        if (!dept) return
        const rate = dept.complianceRate
        data.cell.styles.textColor =
          rate >= 80 ? COLORS.success : rate >= 60 ? COLORS.warning : COLORS.danger
      }
    },
  })

  // @ts-expect-error autoTable enjekte edilen finalY
  return (doc.lastAutoTable?.finalY ?? startY + 40) + 8
}
