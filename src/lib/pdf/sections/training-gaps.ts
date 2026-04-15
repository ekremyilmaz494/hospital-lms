/**
 * Eksik eğitim listesi — kim hangi eğitimi atanmış ama tamamlamamış.
 */
import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, SPACING } from '../theme'
import { tr, formatDateShort } from '../helpers/text'

export function renderTrainingGaps(doc: jsPDF, ctx: ReportContext, startY: number): number {
  const marginX = SPACING.pageMarginX

  doc.setFontSize(FONT_SIZES.sectionTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr('4. Eksik Egitim Listesi'), marginX, startY)

  if (ctx.trainingGaps.length === 0) {
    doc.setFontSize(FONT_SIZES.body)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(
      tr('Gecikmis egitim bulunmamaktadir. Tum personel atamalarinin takibi guncel.'),
      marginX, startY + 8
    )
    return startY + 14
  }

  // Kısa not
  doc.setFontSize(FONT_SIZES.body)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(
    tr(
      `14+ gun once atanmis, henuz tamamlanmamis ${ctx.trainingGaps.length} atama listelenmektedir.`
    ),
    marginX, startY + 5
  )

  const rows = ctx.trainingGaps.map(g => [
    tr(g.userName),
    tr(g.department ?? '—'),
    tr(g.trainingTitle),
    g.dueDate ? formatDateShort(g.dueDate) : '—',
    g.daysOverdue !== null ? `${g.daysOverdue} gun` : '—',
  ])

  autoTable(doc, {
    startY: startY + 10,
    head: [[tr('Personel'), tr('Departman'), tr('Egitim'), tr('Atama'), tr('Gecikme')]],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.warning,
      textColor: [255, 255, 255],
      fontSize: FONT_SIZES.small,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: FONT_SIZES.micro,
      textColor: COLORS.textDark,
      cellPadding: 2,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: COLORS.surfaceAlt },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: COLORS.danger },
    },
    margin: { left: marginX, right: marginX, top: 14, bottom: 16 },
  })

  // @ts-expect-error autoTable enjekte edilen finalY
  return (doc.lastAutoTable?.finalY ?? startY + 40) + 8
}
