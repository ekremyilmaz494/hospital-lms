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

/** Draw decorative border on the PDF */
function drawBorder(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  // Outer border
  doc.setDrawColor(13, 150, 104)
  doc.setLineWidth(2)
  doc.rect(10, 10, w - 20, h - 20)

  // Inner border
  doc.setLineWidth(0.5)
  doc.setDrawColor(13, 150, 104)
  doc.rect(16, 16, w - 32, h - 32)

  // Corner accents
  const cornerSize = 20
  const corners = [
    { x: 10, y: 10 },
    { x: w - 10 - cornerSize, y: 10 },
    { x: 10, y: h - 10 - cornerSize },
    { x: w - 10 - cornerSize, y: h - 10 - cornerSize },
  ]
  doc.setLineWidth(1.5)
  for (const c of corners) {
    doc.rect(c.x, c.y, cornerSize, cornerSize)
  }

  // Top and bottom accent lines
  doc.setDrawColor(6, 95, 70)
  doc.setLineWidth(3)
  const centerX = w / 2
  doc.line(centerX - 50, 14, centerX + 50, 14)
  doc.line(centerX - 40, h - 14, centerX + 40, h - 14)
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
            organization: { select: { name: true } },
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

    // Generate PDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pageW = doc.internal.pageSize.getWidth() // 297
    const pageH = doc.internal.pageSize.getHeight() // 210
    const centerX = pageW / 2

    // Background
    doc.setFillColor(248, 250, 252)
    doc.rect(0, 0, pageW, pageH, 'F')

    // Draw decorative border
    drawBorder(doc)

    // Organization name
    const orgName = certificate.user.organization?.name ?? 'Hastane LMS'
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(100, 116, 139)
    doc.text(orgName.toUpperCase(), centerX, 36, { align: 'center' })

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(28)
    doc.setTextColor(13, 150, 104)
    doc.text('BASARI SERTIFIKASI', centerX, 52, { align: 'center' })

    // Divider line
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.5)
    doc.line(centerX - 60, 58, centerX + 60, 58)

    // Subtitle
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(148, 163, 184)
    doc.text('Bu sertifika asagidaki kisiye verilmistir', centerX, 70, {
      align: 'center',
    })

    // Staff name
    const fullName = `${certificate.user.firstName} ${certificate.user.lastName}`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(15, 23, 42)
    doc.text(fullName, centerX, 85, { align: 'center' })

    // Training name
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('EGITIM', centerX, 100, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(13, 150, 104)

    // Handle long training titles
    const titleLines = doc.splitTextToSize(certificate.training.title, 200)
    doc.text(titleLines, centerX, 110, { align: 'center' })

    const titleOffset = (titleLines.length - 1) * 7

    // Score (if available)
    const score = certificate.attempt.postExamScore
      ? Number(certificate.attempt.postExamScore)
      : null
    if (score !== null) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(148, 163, 184)
      doc.text('PUAN', centerX, 125 + titleOffset, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(15, 23, 42)
      doc.text(`${score}%`, centerX, 134 + titleOffset, { align: 'center' })
    }

    // Bottom info section
    const bottomY = 160 + titleOffset
    const colWidth = 60
    const cols = [
      centerX - colWidth * 1.5,
      centerX - colWidth * 0.5,
      centerX + colWidth * 0.5,
    ]

    // Certificate code
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('SERTIFIKA KODU', cols[0], bottomY, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(13, 150, 104)
    doc.text(certificate.certificateCode, cols[0], bottomY + 7, {
      align: 'center',
    })

    // Issue date
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('VERILIS TARIHI', cols[1], bottomY, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(formatDateTR(certificate.issuedAt), cols[1], bottomY + 7, {
      align: 'center',
    })

    // Expiry date (if exists)
    if (certificate.expiresAt) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text('GECERLILIK TARIHI', cols[2], bottomY, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const isExpired = new Date(certificate.expiresAt) < new Date()
      doc.setTextColor(isExpired ? 220 : 15, isExpired ? 38 : 23, isExpired ? 38 : 42)
      doc.text(formatDateTR(certificate.expiresAt), cols[2], bottomY + 7, {
        align: 'center',
      })
    }

    // QR Code for verification
    try {
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/certificates/verify/${certificate.certificateCode}`
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#0d9668', light: '#f8fafc' },
      })
      const qrX = pageW - 16 - 35
      const qrY = pageH - 16 - 35 - 8
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 35, 35)

      // Verification code text below QR
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(148, 163, 184)
      doc.text(`Dogrulama: ${certificate.certificateCode}`, qrX + 17.5, qrY + 38, {
        align: 'center',
      })
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
