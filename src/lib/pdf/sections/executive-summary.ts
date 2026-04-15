/**
 * Yönetici özeti — genel uyum %, durum kartları, mini bar.
 */
import type { jsPDF } from 'jspdf'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, PAGE, SPACING } from '../theme'
import { tr } from '../helpers/text'
import { getProfile } from '../standards'

export function renderExecutiveSummary(doc: jsPDF, ctx: ReportContext, startY: number): number {
  const profile = getProfile(ctx.report.standardBody)
  const { findings, report } = ctx
  const compliant = findings.filter(f => f.status === 'compliant').length
  const atRisk = findings.filter(f => f.status === 'at_risk').length
  const nonCompliant = findings.filter(f => f.status === 'non_compliant').length
  const total = findings.length || 1

  const marginX = SPACING.pageMarginX
  const fullW = PAGE.width - marginX * 2
  let y = startY

  // Section başlık
  doc.setFontSize(FONT_SIZES.sectionTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr('1. Yonetici Ozeti'), marginX, y)
  y += 7

  doc.setFontSize(FONT_SIZES.body)
  doc.setTextColor(...COLORS.textMuted)
  const lines = doc.splitTextToSize(
    tr(
      `Bu rapor, denetim doneminde ${total} ${profile.terminology.standardWord.toLowerCase()} uzerinden ` +
      `kurumun ${profile.terminology.complianceWord.toLowerCase()} performansini degerlendirmektedir. ` +
      `Genel uyum orani %${Math.round(report.overallComplianceRate)} olarak hesaplanmistir.`
    ),
    fullW
  )
  doc.text(lines, marginX, y)
  y += lines.length * 5 + 4

  // --- Durum kartları (3'lü) ---
  const cardW = (fullW - 8) / 3
  const cardH = 24
  const cards: Array<{ label: string; value: number; color: [number, number, number]; bg: [number, number, number] }> = [
    { label: 'Uyumlu',       value: compliant,    color: COLORS.success, bg: COLORS.successBg },
    { label: 'Risk Altinda', value: atRisk,       color: COLORS.warning, bg: COLORS.warningBg },
    { label: 'Uyumsuz',      value: nonCompliant, color: COLORS.danger,  bg: COLORS.dangerBg },
  ]

  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + 4)

    doc.setFillColor(...c.bg)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')

    // Sol kenar vurgu
    doc.setFillColor(...c.color)
    doc.rect(x, y, 1.5, cardH, 'F')

    // Değer
    doc.setFontSize(20)
    doc.setTextColor(...c.color)
    doc.text(String(c.value), x + 6, y + 12)

    // Label
    doc.setFontSize(FONT_SIZES.small)
    doc.setTextColor(...COLORS.textDark)
    doc.text(tr(c.label), x + 6, y + 18)

    // Yüzde
    const pct = Math.round((c.value / total) * 100)
    doc.setFontSize(FONT_SIZES.micro)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(`%${pct} · toplamin`, x + 6, y + 22)
  })

  y += cardH + 8

  // --- Uyum dağılımı bar (stacked) ---
  doc.setFontSize(FONT_SIZES.small)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(tr('Standart Dagilimi'), marginX, y)
  y += 3

  const barH = 5
  let cursorX = marginX
  const barSegments: Array<{ width: number; color: [number, number, number] }> = [
    { width: (compliant / total) * fullW, color: COLORS.success },
    { width: (atRisk / total) * fullW, color: COLORS.warning },
    { width: (nonCompliant / total) * fullW, color: COLORS.danger },
  ]
  barSegments.forEach(seg => {
    if (seg.width <= 0) return
    doc.setFillColor(...seg.color)
    doc.rect(cursorX, y, seg.width, barH, 'F')
    cursorX += seg.width
  })
  y += barH + 8

  return y
}
