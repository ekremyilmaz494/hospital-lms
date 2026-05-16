/**
 * Standart bulguları tablosu — jspdf-autotable ile multi-page word-wrap.
 */
import type { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, PAGE, SPACING } from '../theme'
import { tr } from '../helpers/text'
import { getProfile } from '../standards'

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Uyumlu',
  at_risk: 'Risk Altinda',
  non_compliant: 'Uyumsuz',
}

export function renderStandardsTable(doc: jsPDF, ctx: ReportContext, startY: number): number {
  const profile = getProfile(ctx.report.standardBody)
  const marginX = SPACING.pageMarginX

  // Section başlık
  doc.setFontSize(FONT_SIZES.sectionTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr(`2. ${profile.terminology.standardWord} Bulgulari`), marginX, startY)

  const headers = [[
    tr('Kod'),
    tr(profile.terminology.standardWord),
    tr('Hedef %'),
    tr('Gerceklesen %'),
    tr('Eksik Personel'),
    tr('Durum'),
  ]]

  const rows = ctx.findings.map(f => [
    tr(f.standardCode),
    tr(f.standardTitle),
    `${f.requiredRate}%`,
    `${f.actualRate}%`,
    String(f.missingStaffCount),
    tr(STATUS_LABELS[f.status] ?? f.status),
  ])

  autoTable(doc, {
    startY: startY + 4,
    head: headers,
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: profile.accentColor,
      textColor: [255, 255, 255],
      fontSize: FONT_SIZES.small,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: FONT_SIZES.small,
      textColor: COLORS.textDark,
      cellPadding: 2.5,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: COLORS.surfaceAlt,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX, top: 14, bottom: 16 },
    didParseCell(data) {
      // Durum hücresine renk
      if (data.section === 'body' && data.column.index === 5) {
        const status = ctx.findings[data.row.index]?.status
        if (status === 'compliant') {
          data.cell.styles.textColor = COLORS.success
        } else if (status === 'at_risk') {
          data.cell.styles.textColor = COLORS.warning
          data.cell.styles.fillColor = COLORS.warningBg
        } else if (status === 'non_compliant') {
          data.cell.styles.textColor = COLORS.danger
          data.cell.styles.fillColor = COLORS.dangerBg
        }
      }
    },
  })

  // @ts-expect-error autoTable enjekte edilen finalY
  return (doc.lastAutoTable?.finalY ?? startY + 40) + 8
}

// PAGE reference kullanılmadı ama tutarlılık için import bırakıldı
void PAGE
