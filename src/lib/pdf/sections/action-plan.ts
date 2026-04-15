/**
 * Aksiyon planı — non-compliant + at-risk standartlar için öneri + son tarih.
 */
import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, SPACING } from '../theme'
import { tr, formatDateShort } from '../helpers/text'

const SEVERITY_LABELS: Record<string, string> = {
  non_compliant: 'Yuksek',
  at_risk: 'Orta',
}

export function renderActionPlan(doc: jsPDF, ctx: ReportContext, startY: number): number {
  const marginX = SPACING.pageMarginX

  doc.setFontSize(FONT_SIZES.sectionTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr('5. Aksiyon Plani'), marginX, startY)

  if (ctx.actionPlan.length === 0) {
    doc.setFontSize(FONT_SIZES.body)
    doc.setTextColor(...COLORS.success)
    doc.text(
      tr('Tebrikler — tum standartlar uyum esigini saglamaktadir.'),
      marginX, startY + 8
    )
    return startY + 14
  }

  doc.setFontSize(FONT_SIZES.body)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(
    tr('Oncelik siralamasi: yuksek > orta. Son tarihler oneri niteligindedir.'),
    marginX, startY + 5
  )

  const rows = ctx.actionPlan.map(a => [
    tr(a.standardCode),
    tr(a.standardTitle),
    tr(SEVERITY_LABELS[a.severity] ?? a.severity),
    `-%${a.gapPercent}`,
    String(a.missingStaffCount),
    tr(a.recommendation),
    formatDateShort(a.deadline),
  ])

  autoTable(doc, {
    startY: startY + 10,
    head: [[
      tr('Kod'),
      tr('Standart'),
      tr('Oncelik'),
      tr('Acik'),
      tr('Kisi'),
      tr('Onerilen Aksiyon'),
      tr('Son Tarih'),
    ]],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.danger,
      textColor: [255, 255, 255],
      fontSize: FONT_SIZES.small,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: FONT_SIZES.micro,
      textColor: COLORS.textDark,
      cellPadding: 2.5,
      lineColor: COLORS.border,
      lineWidth: 0.1,
      valign: 'top',
    },
    alternateRowStyles: { fillColor: COLORS.surfaceAlt },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 36 },
      2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 22, halign: 'center' },
    },
    margin: { left: marginX, right: marginX, top: 14, bottom: 16 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) {
        const row = ctx.actionPlan[data.row.index]
        if (!row) return
        data.cell.styles.textColor =
          row.severity === 'non_compliant' ? COLORS.danger : COLORS.warning
        data.cell.styles.fillColor =
          row.severity === 'non_compliant' ? COLORS.dangerBg : COLORS.warningBg
      }
    },
  })

  // @ts-expect-error autoTable enjekte edilen finalY
  return (doc.lastAutoTable?.finalY ?? startY + 40) + 8
}
