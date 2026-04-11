import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { jsPDF } from 'jspdf'
import { NextRequest } from 'next/server'
import QRCode from 'qrcode'

/** Format date in Turkish locale */
function formatDateTR(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Color constants ───────────────────────────────────────────
const GREEN = { r: 13, g: 150, b: 104 }      // #0d9668 — primary
const DARK_GREEN = { r: 6, g: 95, b: 70 }     // #065f46
const DARK = { r: 30, g: 30, b: 30 }          // #1e1e1e
const BLACK = { r: 15, g: 23, b: 42 }         // #0f172a
const GOLD = { r: 180, g: 140, b: 50 }        // #B48C32
const GOLD_DARK = { r: 150, g: 110, b: 30 }   // #966E1E
const MUTED = { r: 148, g: 163, b: 184 }      // #94a3b8
const BG = { r: 252, g: 253, b: 254 }         // #fcfdfe

/** Draw subtle diamond/cross-hatch background pattern */
function drawBackgroundPattern(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(200, 210, 220)
  doc.setLineWidth(0.15)

  const spacing = 8
  // Diamond pattern — diagonal lines
  for (let x = 0; x < w + h; x += spacing) {
    doc.line(x, 0, x - h, h)
    doc.line(x - w, 0, x, h)
  }
}

/** Draw geometric Greek key / corner ornament */
function drawCornerOrnament(doc: jsPDF, cx: number, cy: number, size: number, rotation: number) {
  doc.saveGraphicsState()
  doc.setFillColor(DARK.r, DARK.g, DARK.b)
  doc.setDrawColor(DARK.r, DARK.g, DARK.b)
  doc.setLineWidth(0)

  const s = size
  const t = s * 0.18  // thickness of the key bars
  const gap = s * 0.08

  // Build the Greek key as a series of rectangles relative to corner
  // We'll draw in top-left orientation, then mirror for other corners
  const blocks: Array<{ x: number; y: number; w: number; h: number }> = [
    // Outer frame — top bar
    { x: 0, y: 0, w: s, h: t },
    // Outer frame — left bar
    { x: 0, y: 0, w: t, h: s },
    // Outer frame — bottom bar
    { x: 0, y: s - t, w: s, h: t },
    // Outer frame — right bar
    { x: s - t, y: 0, w: t, h: s },
    // Inner key — horizontal
    { x: t + gap, y: t + gap + t + gap, w: s - 2 * (t + gap), h: t },
    // Inner key — vertical
    { x: t + gap + t + gap, y: t + gap, w: t, h: s - 2 * (t + gap) },
    // Inner center block
    { x: s * 0.38, y: s * 0.38, w: s * 0.24, h: s * 0.24 },
  ]

  for (const b of blocks) {
    let rx = b.x, ry = b.y

    // Mirror based on rotation (0=TL, 1=TR, 2=BL, 3=BR)
    if (rotation === 1 || rotation === 3) rx = s - b.x - b.w
    if (rotation === 2 || rotation === 3) ry = s - b.y - b.h

    doc.rect(cx + rx, cy + ry, b.w, b.h, 'F')
  }

  doc.restoreGraphicsState()
}

/** Draw curved green and dark diagonal stripes */
function drawDiagonalStripes(doc: jsPDF, w: number, h: number) {
  // ── Top-left green curved stripe ──
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b)
  // Large triangle from top-left
  const triPoints1: Array<[number, number]> = [
    [0, 0],
    [w * 0.38, 0],
    [0, h * 0.42],
  ]
  drawPolygon(doc, triPoints1, 'F')

  // Dark stripe behind the green (slightly offset)
  doc.setFillColor(DARK.r, DARK.g, DARK.b)
  const triPoints2: Array<[number, number]> = [
    [0, 0],
    [w * 0.32, 0],
    [0, h * 0.35],
  ]
  drawPolygon(doc, triPoints2, 'F')

  // Thinner green accent on top
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b)
  const triPoints3: Array<[number, number]> = [
    [0, 0],
    [w * 0.22, 0],
    [0, h * 0.24],
  ]
  drawPolygon(doc, triPoints3, 'F')

  // ── Bottom-right dark curved stripe ──
  doc.setFillColor(DARK.r, DARK.g, DARK.b)
  const triPoints4: Array<[number, number]> = [
    [w, h],
    [w - w * 0.38, h],
    [w, h - h * 0.42],
  ]
  drawPolygon(doc, triPoints4, 'F')

  // Green stripe on bottom-right
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b)
  const triPoints5: Array<[number, number]> = [
    [w, h],
    [w - w * 0.28, h],
    [w, h - h * 0.32],
  ]
  drawPolygon(doc, triPoints5, 'F')

  // Darker accent
  doc.setFillColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b)
  const triPoints6: Array<[number, number]> = [
    [w, h],
    [w - w * 0.18, h],
    [w, h - h * 0.20],
  ]
  drawPolygon(doc, triPoints6, 'F')
}

/** Draw a filled polygon from array of [x,y] points */
function drawPolygon(doc: jsPDF, points: Array<[number, number]>, style: string) {
  if (points.length < 3) return
  const [startX, startY] = points[0]
  // Build path relative to first point
  const lines: Array<[number, number]> = []
  for (let i = 1; i < points.length; i++) {
    lines.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]])
  }
  // Close path back to start
  lines.push([startX - points[points.length - 1][0], startY - points[points.length - 1][1]])

  doc.lines(lines, startX, startY, [1, 1], style, true)
}

/** Draw golden seal/badge */
function drawGoldSeal(doc: jsPDF, cx: number, cy: number, radius: number) {
  // Outer ring with scalloped edge (starburst)
  const points = 24
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b)

  // Draw starburst shape
  for (let i = 0; i < points; i++) {
    const angle = (i * 2 * Math.PI) / points
    const nextAngle = ((i + 1) * 2 * Math.PI) / points
    const outerR = radius
    const innerR = radius * 0.85

    const x1 = cx + outerR * Math.cos(angle)
    const y1 = cy + outerR * Math.sin(angle)
    const x2 = cx + innerR * Math.cos((angle + nextAngle) / 2)
    const y2 = cy + innerR * Math.sin((angle + nextAngle) / 2)
    const x3 = cx + outerR * Math.cos(nextAngle)
    const y3 = cy + outerR * Math.sin(nextAngle)

    drawPolygon(doc, [[cx, cy], [x1, y1], [x2, y2], [x3, y3]], 'F')
  }

  // Inner circle — darker gold
  doc.setFillColor(GOLD_DARK.r, GOLD_DARK.g, GOLD_DARK.b)
  doc.circle(cx, cy, radius * 0.7, 'F')

  // Inner-inner circle — gold
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b)
  doc.circle(cx, cy, radius * 0.6, 'F')

  // Innermost circle — dark
  doc.setFillColor(GOLD_DARK.r, GOLD_DARK.g, GOLD_DARK.b)
  doc.circle(cx, cy, radius * 0.45, 'F')

  // Center star
  doc.setFillColor(GOLD.r, GOLD.g, GOLD.b)
  const starPoints = 5
  const starOuter = radius * 0.35
  const starInner = radius * 0.15
  for (let i = 0; i < starPoints; i++) {
    const angle1 = (i * 2 * Math.PI) / starPoints - Math.PI / 2
    const angle2 = ((i + 0.5) * 2 * Math.PI) / starPoints - Math.PI / 2
    const angle3 = ((i + 1) * 2 * Math.PI) / starPoints - Math.PI / 2

    const ox = cx + starOuter * Math.cos(angle1)
    const oy = cy + starOuter * Math.sin(angle1)
    const ix = cx + starInner * Math.cos(angle2)
    const iy = cy + starInner * Math.sin(angle2)
    const nx = cx + starOuter * Math.cos(angle3)
    const ny = cy + starOuter * Math.sin(angle3)

    drawPolygon(doc, [[cx, cy], [ox, oy], [ix, iy], [nx, ny]], 'F')
  }

  // "BASARI" text around seal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.setTextColor(255, 255, 255)
  doc.text('BASARI', cx, cy - radius * 0.15, { align: 'center' })
  doc.text('ODULU', cx, cy + radius * 0.05, { align: 'center' })

  // Small star symbols
  doc.setFontSize(4)
  doc.text('* * *', cx, cy + radius * 0.25, { align: 'center' })
}

/** Draw the full professional certificate design */
function drawProfessionalDesign(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  // 1. White background
  doc.setFillColor(BG.r, BG.g, BG.b)
  doc.rect(0, 0, w, h, 'F')

  // 2. Subtle background pattern
  drawBackgroundPattern(doc, w, h)

  // 3. Diagonal stripes (green + dark)
  drawDiagonalStripes(doc, w, h)

  // 4. Corner ornaments
  const ornSize = 28
  const ornMargin = 8
  // Top-left
  drawCornerOrnament(doc, ornMargin, ornMargin, ornSize, 0)
  // Top-right
  drawCornerOrnament(doc, w - ornMargin - ornSize, ornMargin, ornSize, 1)
  // Bottom-left
  drawCornerOrnament(doc, ornMargin, h - ornMargin - ornSize, ornSize, 2)
  // Bottom-right
  drawCornerOrnament(doc, w - ornMargin - ornSize, h - ornMargin - ornSize, ornSize, 3)

  // 5. Gold seal at bottom center
  drawGoldSeal(doc, w / 2, h - 40, 14)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin', 'super_admin'])
  if (roleError) return roleError

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationId: true,
            organization: { select: { name: true, logoUrl: true } },
          },
        },
        training: {
          select: { title: true, category: true, organizationId: true },
        },
        attempt: {
          select: { postExamScore: true, attemptNumber: true },
        },
      },
    })

    if (!certificate) {
      return errorResponse('Sertifika bulunamadi', 404)
    }

    // Org isolation: staff can only download their own certs
    if (dbUser!.role === 'staff') {
      if (certificate.userId !== dbUser!.id) {
        return errorResponse('Bu sertifikaya erisim yetkiniz yok', 403)
      }
    }

    // Admin can only download certs from their org
    if (dbUser!.role === 'admin') {
      if (certificate.training.organizationId !== dbUser!.organizationId) {
        return errorResponse('Bu sertifikaya erisim yetkiniz yok', 403)
      }
    }

    // Generate PDF — landscape A4
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pageW = doc.internal.pageSize.getWidth()   // 297
    const pageH = doc.internal.pageSize.getHeight()   // 210
    const centerX = pageW / 2

    // ─── Draw professional background design ───
    drawProfessionalDesign(doc)

    // ─── Content area (centered, over the design) ───

    // Organization logo (if available)
    const logoUrl = certificate.user.organization?.logoUrl
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl)
        if (logoRes.ok) {
          const logoBuffer = await logoRes.arrayBuffer()
          const logoBase64 = Buffer.from(logoBuffer).toString('base64')
          const contentType = logoRes.headers.get('content-type') ?? 'image/png'
          const logoFormat = contentType.includes('jpeg') || contentType.includes('jpg') ? 'JPEG' : 'PNG'
          const logoDataUrl = `data:${contentType};base64,${logoBase64}`
          // Small diamond-shaped logo area at top center
          doc.addImage(logoDataUrl, logoFormat, centerX - 10, 18, 20, 20)
        }
      } catch (logoErr) {
        logger.warn('Certificate PDF', 'Logo yuklenemedi', logoErr)
      }
    } else {
      // Green diamond placeholder
      doc.setFillColor(GREEN.r, GREEN.g, GREEN.b)
      const dSize = 8
      drawPolygon(doc, [
        [centerX, 20],
        [centerX + dSize, 20 + dSize],
        [centerX, 20 + dSize * 2],
        [centerX - dSize, 20 + dSize],
      ], 'F')
    }

    // Organization name
    const orgName = certificate.user.organization?.name ?? 'Devakent Hastanesi'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(orgName.toUpperCase(), centerX, 44, { align: 'center' })

    // ─── Main Title ───
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(36)
    doc.setTextColor(GREEN.r, GREEN.g, GREEN.b)
    doc.text('SERTIFIKA', centerX, 62, { align: 'center' })

    // Subtitle
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.setTextColor(DARK.r, DARK.g, DARK.b)
    doc.text('BASARI BELGESI', centerX, 72, { align: 'center' })

    // Decorative separator line
    doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b)
    doc.setLineWidth(0.5)
    doc.line(centerX - 40, 77, centerX + 40, 77)

    // "This certificate is presented to"
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text('BU SERTIFIKA ASAGIDAKI KISIYE VERILMISTIR', centerX, 88, {
      align: 'center',
    })

    // ─── Staff name (large, prominent) ───
    const fullName = `${certificate.user.firstName} ${certificate.user.lastName}`
    doc.setFont('helvetica', 'bolditalic')
    doc.setFontSize(28)
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b)
    doc.text(fullName, centerX, 104, { align: 'center' })

    // Name underline
    const nameWidth = doc.getTextWidth(fullName)
    doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b)
    doc.setLineWidth(0.8)
    doc.line(centerX - nameWidth / 2 - 5, 107, centerX + nameWidth / 2 + 5, 107)

    // ─── Training info ───
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text('EGITIM', centerX, 118, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(GREEN.r, GREEN.g, GREEN.b)
    const titleLines = doc.splitTextToSize(certificate.training.title, 180)
    doc.text(titleLines, centerX, 126, { align: 'center' })

    const titleOffset = (titleLines.length - 1) * 6

    // ─── Score (if available) ───
    const score = certificate.attempt.postExamScore
      ? Number(certificate.attempt.postExamScore)
      : null
    if (score !== null) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
      doc.text('SINAV PUANI', centerX, 138 + titleOffset, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(BLACK.r, BLACK.g, BLACK.b)
      doc.text(`${score}%`, centerX, 147 + titleOffset, { align: 'center' })
    }

    // ─── Bottom section: Date | Seal | Signature ───
    const bottomY = 172 + titleOffset
    const leftColX = pageW * 0.22
    const rightColX = pageW * 0.78

    // Date section (left)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text('TARIH', leftColX, bottomY - 2, { align: 'center' })

    doc.setDrawColor(DARK.r, DARK.g, DARK.b)
    doc.setLineWidth(0.4)
    doc.line(leftColX - 25, bottomY + 2, leftColX + 25, bottomY + 2)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b)
    doc.text(formatDateTR(certificate.issuedAt), leftColX, bottomY + 8, { align: 'center' })

    // Signature section (right)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text('IMZA', rightColX, bottomY - 2, { align: 'center' })

    doc.setDrawColor(DARK.r, DARK.g, DARK.b)
    doc.setLineWidth(0.4)
    doc.line(rightColX - 25, bottomY + 2, rightColX + 25, bottomY + 2)

    // ─── Certificate code (small, at very bottom) ───
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(`Sertifika Kodu: ${certificate.certificateCode}`, centerX, pageH - 12, {
      align: 'center',
    })

    // Expiry date (if exists)
    if (certificate.expiresAt) {
      const isExpired = new Date(certificate.expiresAt) < new Date()
      doc.setTextColor(isExpired ? 220 : MUTED.r, isExpired ? 38 : MUTED.g, isExpired ? 38 : MUTED.b)
      doc.text(
        `Gecerlilik: ${formatDateTR(certificate.expiresAt)}${isExpired ? ' (Suresi Dolmus)' : ''}`,
        centerX,
        pageH - 8,
        { align: 'center' }
      )
    }

    // ─── QR Code for verification (bottom-right, inside the stripe area) ───
    try {
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/certificates/verify/${certificate.certificateCode}`
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#ffffff', light: '#00000000' },
      })
      // Position QR in bottom-right area (over the dark stripe)
      const qrX = pageW - 50
      const qrY = pageH - 50
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 22, 22)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5)
      doc.setTextColor(255, 255, 255)
      doc.text('Dogrulama', qrX + 11, qrY + 25, { align: 'center' })
    } catch (qrErr) {
      logger.warn('Certificate PDF', 'QR kod olusturulamadi', qrErr)
    }

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const fileName = `sertifika-${certificate.certificateCode}.pdf`

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    logger.error('Certificate PDF', 'PDF olusturulamadi', err)
    return errorResponse('PDF olusturulamadi', 500)
  }
}
