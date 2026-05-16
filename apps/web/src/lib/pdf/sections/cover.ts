/**
 * Kapak sayfası — hastane branding, rapor başlığı, dönem, standart rozeti.
 */
import type { jsPDF } from 'jspdf'
import type { ReportContext } from '../types'
import { COLORS, FONT_SIZES, PAGE, SPACING } from '../theme'
import { tr, formatDate } from '../helpers/text'
import { mimeToPdfFormat } from '../helpers/logo'
import { getProfile } from '../standards'

export function renderCover(doc: jsPDF, ctx: ReportContext): void {
  const { report, organization, logoDataUrl } = ctx
  const profile = getProfile(report.standardBody)
  const cx = PAGE.width / 2

  // --- Üst accent bant ---
  doc.setFillColor(...profile.accentColor)
  doc.rect(0, 0, PAGE.width, 6, 'F')

  // --- Logo (varsa) ---
  let logoBottomY = 55
  if (logoDataUrl) {
    try {
      const format = mimeToPdfFormat(logoDataUrl)
      const logoMaxW = 40
      const logoMaxH = 28
      doc.addImage(logoDataUrl, format, cx - logoMaxW / 2, 35, logoMaxW, logoMaxH, undefined, 'FAST')
      logoBottomY = 35 + logoMaxH + 6
    } catch {
      // Logo hatası → sessizce text fallback
    }
  }

  // --- Hastane adı (logo altı) ---
  doc.setFontSize(FONT_SIZES.coverSubtitle)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(tr(organization.name.toUpperCase()), cx, logoBottomY + 4, { align: 'center' })

  // --- Ana başlık ---
  const titleY = 115
  doc.setFontSize(FONT_SIZES.coverTitle)
  doc.setTextColor(...COLORS.textDark)
  doc.text(tr('Akreditasyon Uyum Raporu'), cx, titleY, { align: 'center' })

  // --- Alt başlık (standart) ---
  doc.setFontSize(FONT_SIZES.coverSubtitle)
  doc.setTextColor(...profile.accentColor)
  doc.text(tr(profile.bodyLabel), cx, titleY + 10, { align: 'center' })

  // --- Badge (standart edisyonu) ---
  doc.setDrawColor(...profile.accentColor)
  doc.setFillColor(...COLORS.surfaceAlt)
  const badgeText = tr(profile.coverBadge)
  doc.setFontSize(FONT_SIZES.small)
  const badgeW = doc.getTextWidth(badgeText) + 10
  const badgeX = cx - badgeW / 2
  const badgeY = titleY + 18
  doc.roundedRect(badgeX, badgeY, badgeW, 7, 2, 2, 'FD')
  doc.setTextColor(...profile.accentColor)
  doc.text(badgeText, cx, badgeY + 4.8, { align: 'center' })

  // --- Dönem bilgisi (orta alan) ---
  const metaY = 170
  doc.setDrawColor(...COLORS.border)
  doc.line(40, metaY - 10, PAGE.width - 40, metaY - 10)

  doc.setFontSize(FONT_SIZES.small)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(tr('DENETIM DONEMI'), cx, metaY, { align: 'center' })

  doc.setFontSize(FONT_SIZES.bodyLarge)
  doc.setTextColor(...COLORS.textDark)
  doc.text(
    `${formatDate(report.periodStart)}  —  ${formatDate(report.periodEnd)}`,
    cx, metaY + 7, { align: 'center' }
  )

  // --- Genel uyum yüzdesi (büyük, merkez) ---
  const rate = report.overallComplianceRate
  const rateColor =
    rate >= 80 ? COLORS.success : rate >= 60 ? COLORS.warning : COLORS.danger

  const rateY = 215
  doc.setFontSize(FONT_SIZES.small)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(tr('GENEL UYUM ORANI'), cx, rateY, { align: 'center' })

  doc.setFontSize(52)
  doc.setTextColor(...rateColor)
  doc.text(`%${Math.round(rate)}`, cx, rateY + 22, { align: 'center' })

  // --- Alt meta (rapor tarihi) ---
  const footerY = PAGE.height - SPACING.pageMarginBottom - 8
  doc.setDrawColor(...COLORS.border)
  doc.line(SPACING.pageMarginX, footerY - 6, PAGE.width - SPACING.pageMarginX, footerY - 6)

  doc.setFontSize(FONT_SIZES.small)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(tr(`Rapor Tarihi: ${formatDate(report.generatedAt)}`), SPACING.pageMarginX, footerY)
  doc.text(tr('GIZLI — Kurumsal Ic Kullanim'), PAGE.width - SPACING.pageMarginX, footerY, { align: 'right' })

  // --- Alt accent bant ---
  doc.setFillColor(...profile.accentColor)
  doc.rect(0, PAGE.height - 6, PAGE.width, 6, 'F')
}
