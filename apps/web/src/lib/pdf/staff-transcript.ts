/**
 * Personel Eğitim Transkripti PDF üretici.
 *
 * Kümülatif tamamlanmış eğitim listesi — sertifikalı döküm.
 * applyTurkishFont + jspdf-autotable kullanır.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from './helpers/font'
import { mimeToPdfFormat } from './helpers/logo'

export interface TranscriptEntry {
  trainingTitle: string
  category: string
  issuedAt: string
  score: number | null
  certificateCode: string
}

export interface TranscriptData {
  fullName: string
  organizationName: string
  generatedAt: string
  /** Kurum logosu data URL'i (resolveOrgLogoDataUrl ile çözülür); yoksa null. */
  logoDataUrl: string | null
  entries: TranscriptEntry[]
}

export async function buildTranscriptPdf(data: TranscriptData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = 210
  const NAVY: [number, number, number] = [11, 30, 63]
  const GOLD: [number, number, number] = [201, 169, 97]
  const CREAM: [number, number, number] = [250, 246, 235]
  const INK: [number, number, number] = [35, 40, 55]
  const SOFT: [number, number, number] = [110, 115, 125]

  // Header bar
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 28, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 28, W, 2, 'F')

  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('Eğitim Tamamlama Transkripti', 15, 13)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.text(data.organizationName, 15, 22)

  // Kurum logosu — NAVY başlığın sağında beyaz tile (en-boy oranı korunur)
  if (data.logoDataUrl) {
    try {
      const props = doc.getImageProperties(data.logoDataUrl)
      const maxH = 16, maxW = 46
      const scale = Math.min(maxW / props.width, maxH / props.height)
      const lw = props.width * scale
      const lh = props.height * scale
      const pad = 2.5
      const tileW = lw + pad * 2
      const tileH = lh + pad * 2
      const tileX = W - 15 - tileW
      const tileY = (28 - tileH) / 2
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(tileX, tileY, tileW, tileH, 2, 2, 'F')
      doc.addImage(data.logoDataUrl, mimeToPdfFormat(data.logoDataUrl), tileX + pad, tileY + pad, lw, lh, undefined, 'FAST')
    } catch {
      // logo çizilemedi — başlık logosuz devam eder
    }
  }

  // Meta block
  doc.setTextColor(...INK)
  doc.setFontSize(11)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.text(data.fullName, 15, 42)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text(`Oluşturma tarihi: ${data.generatedAt}`, 15, 49)
  doc.text(`Toplam eğitim: ${data.entries.length}`, 15, 55)

  // Table
  autoTable(doc, {
    startY: 62,
    head: [['Eğitim Adı', 'Kategori', 'Tamamlanma', 'Puan', 'Sertifika Kodu']],
    body: data.entries.map(e => [
      e.trainingTitle,
      e.category || '—',
      e.issuedAt,
      e.score != null ? `${e.score.toFixed(0)}` : '—',
      e.certificateCode,
    ]),
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 9,
      textColor: INK,
      lineColor: [220, 216, 200],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 36 },
      2: { cellWidth: 28 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 34, fontStyle: 'normal' },
    },
    margin: { left: 15, right: 15 },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(0.5)
    doc.line(15, 284, W - 15, 284)
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.text('KlinoVax — Hastane Personel Eğitim Sistemi', 15, 289)
    doc.text(`Sayfa ${i} / ${pageCount}`, W - 15, 289, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
