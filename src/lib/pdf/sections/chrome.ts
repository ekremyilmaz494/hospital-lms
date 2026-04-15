/**
 * Sayfa chrome'u — header + footer. Kapak sayfası (sayfa 1) hariç uygulanır.
 * Son adımda çalıştırılır — toplam sayfa sayısı 1/N formatında yazılabilsin diye.
 */
import type { jsPDF } from 'jspdf'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, PAGE, SPACING } from '../theme'
import { tr, formatDateShort } from '../helpers/text'
import { getProfile } from '../standards'

export function renderPageChrome(doc: jsPDF, ctx: ReportContext): void {
  const profile = getProfile(ctx.report.standardBody)
  const total = doc.getNumberOfPages()

  // Sayfa 1 = kapak, atla
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)

    // --- Header ---
    doc.setFillColor(...profile.accentColor)
    doc.rect(0, 0, PAGE.width, 2, 'F')

    doc.setFontSize(FONT_SIZES.micro)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(tr(ctx.organization.name), SPACING.pageMarginX, 9)
    doc.text(
      tr(`${profile.bodyLabel} Uyum Raporu`),
      PAGE.width - SPACING.pageMarginX,
      9,
      { align: 'right' }
    )

    doc.setDrawColor(...COLORS.border)
    doc.line(SPACING.pageMarginX, 11, PAGE.width - SPACING.pageMarginX, 11)

    // --- Footer ---
    const footerY = PAGE.height - 10

    doc.setDrawColor(...COLORS.border)
    doc.line(SPACING.pageMarginX, footerY - 4, PAGE.width - SPACING.pageMarginX, footerY - 4)

    doc.setFontSize(FONT_SIZES.micro)
    doc.setTextColor(...COLORS.textMuted)

    // Sol: rapor tarihi + gizli ibaresi
    doc.text(
      tr(`${formatDateShort(ctx.report.generatedAt)} · Gizli · Kurumsal Ic Kullanim`),
      SPACING.pageMarginX,
      footerY
    )

    // Sağ: sayfa numarası
    doc.text(`${p} / ${total}`, PAGE.width - SPACING.pageMarginX, footerY, { align: 'right' })
  }
}

/** Yeni sayfa başlat ve başlangıç Y'sini döndür (header'ın altı). */
export function startNewPage(doc: jsPDF): number {
  doc.addPage()
  return SPACING.pageMarginTop
}

/** Eğer Y sayfa sonuna yaklaşıyorsa yeni sayfa aç. */
export function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const limit = PAGE.height - SPACING.pageMarginBottom - 10
  if (y + need > limit) return startNewPage(doc)
  return y
}
