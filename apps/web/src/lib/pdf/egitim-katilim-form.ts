/**
 * Eğitim Katılım ve İmza Formu PDF üretici (SKS denetim belgesi).
 *
 * Bir eğitime atanan personelin katılım/tamamlama durumunu, sınav puanını ve (varsa) ıslak/
 * dijital imza kaydını tek belgede listeler. Islak imzalar (canvas) ikinci sayfada görsel
 * olarak basılır. Denetçi, eğitimin kimler tarafından tamamlanıp imzalandığını tek belgede görür.
 *
 * Çağıran route org-scoped veriyi çeker ve org logosunu `resolveOrgLogoDataUrl` ile data URL'e
 * çevirip `logoDataUrl` olarak geçer (builder ağ/S3 erişimi yapmaz → saf ve test edilebilir).
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from './helpers/font'
import {
  drawAuditFormHeader, drawInfoBand, drawStatCards, drawTableTitleBand, drawAuditFooter,
  formatDate, formatDateLong,
  PRIMARY, PRIMARY_DK, BORDER, SURFACE, TEXT_MUT, TEXT_MAIN, WHITE,
  SUCCESS_BG, WARN_BG, WARN_FG, INFO_BG, INFO_FG, ERROR_FG, type RGB,
} from './audit-form-chrome'

export interface KatilimFormParticipant {
  fullName: string
  /** Ünvan ve bölüm birleşik (örn. "Hemşire / Yoğun Bakım"). */
  roleDept: string
  /** TrainingAssignment.status (passed/failed/in_progress/assigned/locked). */
  status: string
  completedAt: Date | string | null
  score: number | null
  signedAt: Date | string | null
  /** 'canvas' | 'acknowledge' | null */
  signatureMethod: string | null
}

export interface KatilimFormSignature {
  fullName: string
  roleDept: string
  signedAt: Date | string | null
  /** Islak imza PNG data URL'i (canvas). */
  data: string
}

export interface KatilimFormData {
  trainingTitle: string
  category: string | null
  startDate: Date | string | null
  endDate: Date | string | null
  organizationName: string
  logoDataUrl: string | null
  docRef: string
  participants: KatilimFormParticipant[]
  /** Yalnızca canvas (ıslak) imzalar — ikinci sayfada görsel basılır. */
  signatures: KatilimFormSignature[]
}

function signStatusLabel(method: string | null): string {
  if (method === 'canvas') return 'El İmzası'
  if (method === 'acknowledge') return 'Yazılı Beyan'
  return 'Bekleniyor'
}

export async function buildEgitimKatilimFormPdf(data: KatilimFormData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = doc.internal.pageSize.getWidth()   // 210
  const H = doc.internal.pageSize.getHeight()  // 297

  // ── HEADER ──
  drawAuditFormHeader(doc, {
    eyebrow: 'EĞİTİM KATILIM VE İMZA FORMU',
    title: data.trainingTitle,
    subtitle: data.organizationName,
    logoDataUrl: data.logoDataUrl,
    metaRows: [
      { label: 'BELGE NO', value: `#${data.docRef}` },
      { label: 'DÜZENLENME TARİHİ', value: formatDateLong(new Date()) },
      { label: 'DÜZENLEYEN', value: data.organizationName },
    ],
  })

  // ── INFO BAND ──
  const dateRange = (data.startDate && data.endDate)
    ? `${formatDate(data.startDate)} — ${formatDate(data.endDate)}`
    : 'Belirtilmemiş'
  let y = drawInfoBand(doc, [
    { label: 'KATEGORİ',       value: data.category ?? '—' },
    { label: 'EĞİTİM SÜRESİ',  value: dateRange },
    { label: 'TOPLAM ATANAN',  value: String(data.participants.length) },
  ], 48)

  // ── STAT CARDS ──
  const total     = data.participants.length
  const completed = data.participants.filter(p => p.status === 'passed').length
  const signed    = data.participants.filter(p => !!p.signedAt).length
  const pending   = total - signed
  y += 6
  y = drawStatCards(doc, [
    { label: 'Tamamlayan', value: String(completed), bg: SUCCESS_BG, color: PRIMARY },
    { label: 'İmzalayan',  value: String(signed),    bg: SUCCESS_BG, color: PRIMARY },
    { label: 'Bekleniyor', value: String(pending),   bg: pending > 0 ? WARN_BG : SUCCESS_BG, color: pending > 0 ? WARN_FG : PRIMARY },
    { label: 'Toplam',     value: String(total),     bg: INFO_BG, color: INFO_FG },
  ], y)

  // ── TABLE ──
  y += 6
  y = drawTableTitleBand(doc, 'KATILIMCI LİSTESİ', y)
  y += 1

  const rows = data.participants.map((p, i) => [
    String(i + 1),
    p.fullName || '—',
    p.roleDept || '—',
    formatDate(p.completedAt),
    p.score != null ? `%${p.score}` : '—',
    formatDate(p.signedAt),
    signStatusLabel(p.signatureMethod),
  ])

  autoTable(doc, {
    startY: y + 1,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Ünvan / Bölüm', 'Tamamlama', 'Puan', 'İmza Tarihi', 'İmza Durumu']],
    body: rows,
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 7.5,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: TEXT_MAIN,
    },
    headStyles: {
      font: TURKISH_FONT_FAMILY,
      fillColor: [241, 245, 249],
      textColor: TEXT_MUT,
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 42 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 28, halign: 'center' },
    },
    didParseCell(cell) {
      // İmza durumu renklendir
      if (cell.section === 'body' && cell.column.index === 6) {
        const val = String(cell.cell.raw)
        if (val === 'El İmzası' || val === 'Yazılı Beyan') {
          cell.cell.styles.textColor = PRIMARY
          cell.cell.styles.fontStyle = 'bold'
        } else if (val === 'Bekleniyor') {
          cell.cell.styles.textColor = WARN_FG as RGB
        }
      }
      // Puan renklendir
      if (cell.section === 'body' && cell.column.index === 4 && cell.cell.raw !== '—') {
        const score = parseInt(String(cell.cell.raw).replace('%', ''), 10)
        cell.cell.styles.textColor = score >= 90 ? PRIMARY : score >= 70 ? TEXT_MAIN : ERROR_FG
        cell.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ── SIGNATURE PAGE (ıslak imzalar) ──
  if (data.signatures.length > 0) {
    doc.addPage()

    // İmza sayfası başlığı
    doc.setFillColor(...PRIMARY_DK)
    doc.rect(0, 0, W, 20, 'F')
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 18, W, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...WHITE)
    doc.text('EL İMZALARI', W / 2, 13, { align: 'center' })

    const SIG_W = 82
    const SIG_H = 26
    const cols  = [14, 112]
    let row = 0
    let sy  = 28

    for (let i = 0; i < data.signatures.length; i++) {
      const col = i % 2
      if (col === 0 && i > 0) {
        row++
        sy = 28 + row * 52
      }
      if (sy + SIG_H + 20 > H - 15) {
        doc.addPage()
        doc.setFillColor(...PRIMARY_DK)
        doc.rect(0, 0, W, 20, 'F')
        doc.setFillColor(...PRIMARY)
        doc.rect(0, 18, W, 2, 'F')
        doc.setFont(TURKISH_FONT_FAMILY, 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...WHITE)
        doc.text('EL İMZALARI (devam)', W / 2, 13, { align: 'center' })
        row = 0
        sy  = 28
      }

      const sig = data.signatures[i]
      const x   = cols[col]

      // Kart arka planı
      doc.setFillColor(...SURFACE)
      doc.roundedRect(x, sy, SIG_W + 2, SIG_H + 18, 2, 2, 'F')
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, sy, SIG_W + 2, SIG_H + 18, 2, 2, 'S')

      // Ad + ünvan/bölüm
      doc.setFont(TURKISH_FONT_FAMILY, 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MAIN)
      doc.text(doc.splitTextToSize(sig.fullName || '—', SIG_W - 4)[0] as string, x + 3, sy + 5.5)
      doc.setFont(TURKISH_FONT_FAMILY, 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_MUT)
      doc.text(doc.splitTextToSize(sig.roleDept || '—', SIG_W - 4)[0] as string, x + 3, sy + 9.5)

      // İmza görsel alanı
      doc.setFillColor(...WHITE)
      doc.rect(x + 2, sy + 11, SIG_W - 2, SIG_H, 'F')
      try {
        doc.addImage(sig.data, 'PNG', x + 2, sy + 11, SIG_W - 2, SIG_H)
      } catch {
        doc.setFont(TURKISH_FONT_FAMILY, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...TEXT_MUT)
        doc.text('[İmza görseli yüklenemedi]', x + SIG_W / 2, sy + 11 + SIG_H / 2, { align: 'center' })
      }

      // İmzalanma tarihi alt bandı
      doc.setFillColor(...PRIMARY)
      doc.roundedRect(x, sy + SIG_H + 11, SIG_W + 2, 6.5, 2, 2, 'F')
      doc.setFont(TURKISH_FONT_FAMILY, 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...WHITE)
      doc.text(`İmzalanma: ${formatDate(sig.signedAt)}`, x + (SIG_W + 2) / 2, sy + SIG_H + 15.5, { align: 'center' })
    }
  }

  // ── FOOTER (tüm sayfalar) ──
  drawAuditFooter(doc, {
    orgName: data.organizationName,
    centerText: `Eğitim Katılım ve İmza Formu · ${data.trainingTitle}`,
  })

  return Buffer.from(doc.output('arraybuffer'))
}
