import { jsPDF } from 'jspdf'
import { TURKISH_FONT_FAMILY } from './helpers/font'

export const CERT_COLORS = {
  NAVY: [11, 30, 63] as [number, number, number],
  NAVY_DARK: [6, 20, 45] as [number, number, number],
  NAVY_MID: [22, 48, 90] as [number, number, number],
  GOLD: [201, 169, 97] as [number, number, number],
  GOLD_LIGHT: [230, 200, 138] as [number, number, number],
  GOLD_DARK: [165, 130, 60] as [number, number, number],
  CREAM: [250, 246, 235] as [number, number, number],
  WHITE: [255, 255, 255] as [number, number, number],
  MUTED: [110, 115, 125] as [number, number, number],
  TEXT: [35, 40, 55] as [number, number, number],
  RED: [200, 40, 40] as [number, number, number],
} as const

export interface CertDrawData {
  fullName: string
  trainingTitle: string
  organizationName: string
  organizationLogoDataUrl?: string | null
  issuedAtText: string
  expiresAtText: string | null
  isExpired: boolean
  isRevoked: boolean
  certificateCode: string
  score: number | null
  location?: string
}

type RGB = readonly [number, number, number]

function poly(doc: jsPDF, pts: Array<[number, number]>, style: 'F' | 'S' | 'DF') {
  if (pts.length < 3) return
  const [sx, sy] = pts[0]
  const lines: Array<[number, number]> = []
  for (let i = 1; i < pts.length; i++) {
    lines.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])
  }
  lines.push([sx - pts[pts.length - 1][0], sy - pts[pts.length - 1][1]])
  doc.lines(lines, sx, sy, [1, 1], style, true)
}

const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])
const setDraw = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
const setText = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])

/** Four layered triangular "paper folds" in one corner, yeniii.png style. */
function drawCornerBlock(
  doc: jsPDF,
  ox: number,
  oy: number,
  w: number,
  h: number,
  flipX: boolean,
  flipY: boolean,
) {
  const mx = (x: number) => (flipX ? ox + w - x : ox + x)
  const my = (y: number) => (flipY ? oy + h - y : oy + y)

  setFill(doc, CERT_COLORS.NAVY)
  poly(doc, [[mx(0), my(0)], [mx(w), my(0)], [mx(0), my(h)]], 'F')

  setFill(doc, CERT_COLORS.NAVY_DARK)
  poly(doc, [[mx(0), my(0)], [mx(w * 0.72), my(0)], [mx(0), my(h * 0.75)]], 'F')

  setFill(doc, CERT_COLORS.GOLD)
  poly(
    doc,
    [
      [mx(w * 0.72), my(0)],
      [mx(w * 0.82), my(0)],
      [mx(0), my(h * 0.82)],
      [mx(0), my(h * 0.75)],
    ],
    'F',
  )

  setFill(doc, CERT_COLORS.NAVY_MID)
  poly(
    doc,
    [
      [mx(w * 0.82), my(0)],
      [mx(w), my(0)],
      [mx(0), my(h)],
      [mx(0), my(h * 0.82)],
    ],
    'F',
  )

  setFill(doc, CERT_COLORS.GOLD_LIGHT)
  poly(
    doc,
    [
      [mx(w * 0.4), my(0)],
      [mx(w * 0.42), my(0)],
      [mx(0), my(h * 0.42)],
      [mx(0), my(h * 0.4)],
    ],
    'F',
  )

  setFill(doc, CERT_COLORS.GOLD)
  poly(doc, [[mx(0), my(0)], [mx(w * 0.08), my(0)], [mx(0), my(h * 0.08)]], 'F')
}

export function drawCertificateBackground(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  setFill(doc, CERT_COLORS.CREAM)
  doc.rect(0, 0, w, h, 'F')

  const cornerW = w * 0.3
  const cornerH = h * 0.4

  drawCornerBlock(doc, 0, 0, cornerW, cornerH, false, false)
  drawCornerBlock(doc, w - cornerW, 0, cornerW, cornerH, true, false)
  drawCornerBlock(doc, 0, h - cornerH, cornerW, cornerH, false, true)
  drawCornerBlock(doc, w - cornerW, h - cornerH, cornerW, cornerH, true, true)

  setDraw(doc, CERT_COLORS.GOLD)
  doc.setLineWidth(0.4)
  const margin = 6
  doc.rect(margin, margin, w - margin * 2, h - margin * 2)
}

function drawGoldMedal(doc: jsPDF, cx: number, cy: number, r: number) {
  const points = 16
  setFill(doc, CERT_COLORS.GOLD)
  for (let i = 0; i < points; i++) {
    const a1 = (i * 2 * Math.PI) / points
    const a2 = ((i + 1) * 2 * Math.PI) / points
    const aMid = (a1 + a2) / 2
    poly(
      doc,
      [
        [cx, cy],
        [cx + r * Math.cos(a1), cy + r * Math.sin(a1)],
        [cx + r * 0.78 * Math.cos(aMid), cy + r * 0.78 * Math.sin(aMid)],
        [cx + r * Math.cos(a2), cy + r * Math.sin(a2)],
      ],
      'F',
    )
  }

  setFill(doc, CERT_COLORS.GOLD_DARK)
  doc.circle(cx, cy, r * 0.72, 'F')
  setFill(doc, CERT_COLORS.GOLD)
  doc.circle(cx, cy, r * 0.6, 'F')
  setFill(doc, CERT_COLORS.GOLD_DARK)
  doc.circle(cx, cy, r * 0.48, 'F')

  setFill(doc, CERT_COLORS.GOLD_LIGHT)
  const sPoints = 5
  const sOuter = r * 0.4
  const sInner = r * 0.16
  for (let i = 0; i < sPoints; i++) {
    const a1 = (i * 2 * Math.PI) / sPoints - Math.PI / 2
    const a2 = ((i + 0.5) * 2 * Math.PI) / sPoints - Math.PI / 2
    const a3 = ((i + 1) * 2 * Math.PI) / sPoints - Math.PI / 2
    poly(
      doc,
      [
        [cx, cy],
        [cx + sOuter * Math.cos(a1), cy + sOuter * Math.sin(a1)],
        [cx + sInner * Math.cos(a2), cy + sInner * Math.sin(a2)],
        [cx + sOuter * Math.cos(a3), cy + sOuter * Math.sin(a3)],
      ],
      'F',
    )
  }
}

export function drawCertificateContent(doc: jsPDF, data: CertDrawData) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const cx = w / 2

  const font = TURKISH_FONT_FAMILY

  let logoBottomY = 32
  const hasLogo = !!data.organizationLogoDataUrl
  if (hasLogo) {
    try {
      const logoHeight = 18
      const logoWidth = 60
      const fmt =
        data.organizationLogoDataUrl!.includes('jpeg') || data.organizationLogoDataUrl!.includes('jpg')
          ? 'JPEG'
          : 'PNG'
      doc.addImage(data.organizationLogoDataUrl!, fmt, cx - logoWidth / 2, 14, logoWidth, logoHeight)
      logoBottomY = 14 + logoHeight + 2
    } catch {
      logoBottomY = 32
    }
  } else {
    setFill(doc, CERT_COLORS.NAVY)
    doc.circle(cx, 26, 6, 'F')
    setFill(doc, CERT_COLORS.GOLD)
    doc.circle(cx, 26, 3, 'F')
    logoBottomY = 34

    doc.setFont(font, 'bold')
    doc.setFontSize(9)
    setText(doc, CERT_COLORS.NAVY)
    doc.text(data.organizationName.toUpperCase(), cx, logoBottomY + 4, { align: 'center' })
    logoBottomY += 4
  }

  doc.setFont(font, 'bold')
  doc.setFontSize(34)
  setText(doc, CERT_COLORS.GOLD_DARK)
  doc.text('BAŞARI SERTİFİKASI', cx, logoBottomY + 20, { align: 'center' })

  setDraw(doc, CERT_COLORS.GOLD)
  doc.setLineWidth(0.3)
  doc.line(cx - 70, logoBottomY + 25, cx - 10, logoBottomY + 25)
  doc.line(cx + 10, logoBottomY + 25, cx + 70, logoBottomY + 25)

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  setText(doc, CERT_COLORS.MUTED)
  doc.text('Bu sertifika,', cx, logoBottomY + 33, { align: 'center' })

  doc.setFont(font, 'bold')
  doc.setFontSize(24)
  setText(doc, CERT_COLORS.NAVY)
  doc.text(data.fullName.toUpperCase(), cx, logoBottomY + 45, { align: 'center' })

  doc.setFont(font, 'bold')
  doc.setFontSize(14)
  setText(doc, CERT_COLORS.NAVY_MID)
  const trainingLines = doc.splitTextToSize(data.trainingTitle, w * 0.7)
  doc.text(trainingLines, cx, logoBottomY + 57, { align: 'center' })
  const trainingOffset = (trainingLines.length - 1) * 6

  doc.setFont(font, 'normal')
  doc.setFontSize(11)
  setText(doc, CERT_COLORS.TEXT)
  doc.text('eğitimini başarıyla tamamlamıştır.', cx, logoBottomY + 65 + trainingOffset, {
    align: 'center',
  })

  const infoY = logoBottomY + 77 + trainingOffset

  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  setText(doc, CERT_COLORS.TEXT)
  doc.text(`Veriliş Tarihi: ${data.issuedAtText}`, cx, infoY, { align: 'center' })

  const expiryLabel = data.expiresAtText
    ? `${data.expiresAtText}${data.isExpired ? ' (Süresi Dolmuş)' : ''}`
    : 'Süresiz'
  setText(doc, data.isExpired ? CERT_COLORS.RED : CERT_COLORS.TEXT)
  doc.text(`Geçerlilik Tarihi: ${expiryLabel}`, cx, infoY + 6, { align: 'center' })

  if (data.score !== null) {
    doc.setFont(font, 'bold')
    doc.setFontSize(10)
    setText(doc, CERT_COLORS.GOLD_DARK)
    doc.text(`Sınav Puanı: %${data.score}`, cx, infoY + 13, { align: 'center' })
  }

  const sigLineY = h - 38
  const leftSigX = w * 0.22
  const rightSigX = w * 0.78

  setDraw(doc, CERT_COLORS.NAVY)
  doc.setLineWidth(0.4)
  doc.line(leftSigX - 28, sigLineY, leftSigX + 28, sigLineY)
  doc.line(rightSigX - 28, sigLineY, rightSigX + 28, sigLineY)

  doc.setFont(font, 'bold')
  doc.setFontSize(9)
  setText(doc, CERT_COLORS.NAVY)
  doc.text('Yetkili İmza', leftSigX, sigLineY + 5, { align: 'center' })
  doc.text('Eğitmen İmza', rightSigX, sigLineY + 5, { align: 'center' })

  doc.setFont(font, 'normal')
  doc.setFontSize(7)
  setText(doc, CERT_COLORS.MUTED)
  doc.text('Official', leftSigX, sigLineY + 10, { align: 'center' })
  doc.text('Mühür', rightSigX, sigLineY + 10, { align: 'center' })

  drawGoldMedal(doc, cx, sigLineY + 2, 10)

  doc.setFont(font, 'normal')
  doc.setFontSize(7)
  setText(doc, CERT_COLORS.MUTED)
  doc.text(`Sertifika Kodu: ${data.certificateCode}`, cx, h - 4, { align: 'center' })

  if (data.isRevoked) {
    doc.setFont(font, 'bold')
    doc.setFontSize(32)
    setText(doc, CERT_COLORS.RED)
    doc.text('İPTAL EDİLMİŞ', cx, h / 2, { align: 'center', angle: -20 })
  }
}

export function drawCertificatePage(doc: jsPDF, data: CertDrawData) {
  drawCertificateBackground(doc)
  drawCertificateContent(doc, data)
}
