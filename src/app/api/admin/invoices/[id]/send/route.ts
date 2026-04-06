import { prisma } from '@/lib/prisma'
import { getAuthUser, assertRole, errorResponse, jsonResponse, createAuditLog } from '@/lib/api-helpers'
import { sendInvoiceEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { jsPDF } from 'jspdf'
import { NextRequest } from 'next/server'

/** Tarih formatla: 05.04.2026 */
function formatDateTR(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Para birimi formatla */
function formatCurrency(amount: number, currency: string = 'TRY'): string {
  const symbol = currency === 'TRY' ? 'TL' : currency
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`
}

/** Fatura PDF buffer olusturur (send icin yeniden uretim) */
function generateInvoicePdfBuffer(invoice: {
  invoiceNumber: string
  status: string
  issuedAt: Date
  billingName: string
  companyName: string | null
  billingAddress: string | null
  taxNumber: string | null
  taxOffice: string | null
  amount: unknown
  taxRate: number | null
  taxAmount: unknown
  totalAmount: unknown
  currency: string
  periodStart: Date
  periodEnd: Date
  paidAt: Date | null
  subscription: { billingCycle: string | null; plan: { name: string } | null }
}): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const leftMargin = 20
  const rightX = pageW - 20

  // Ust bant
  doc.setFillColor(13, 150, 104)
  doc.rect(0, 0, pageW, 40, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('FATURA', leftMargin, 26)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(invoice.invoiceNumber, rightX, 18, { align: 'right' })
  doc.setFontSize(9)
  doc.text(`Tarih: ${formatDateTR(invoice.issuedAt)}`, rightX, 25, { align: 'right' })

  const statusLabel = invoice.status === 'paid' ? 'ODENDI' : invoice.status === 'sent' ? 'GONDERILDI' : 'TASLAK'
  doc.text(`Durum: ${statusLabel}`, rightX, 32, { align: 'right' })

  let y = 55

  // Kesici bilgileri
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 150, 104)
  doc.text('Kesici', leftMargin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  y += 7
  doc.text('Hastane LMS', leftMargin, y)
  y += 5
  doc.text('Saglik Egitim Teknolojileri A.S.', leftMargin, y)
  y += 5
  doc.text('Istanbul, Turkiye', leftMargin, y)

  // Alici bilgileri
  y = 55
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 150, 104)
  doc.text('Alici', rightX - 70, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  y += 7
  doc.text(invoice.billingName, rightX - 70, y)
  if (invoice.companyName) {
    y += 5
    doc.text(invoice.companyName, rightX - 70, y)
  }
  if (invoice.billingAddress) {
    y += 5
    const addrLines = doc.splitTextToSize(invoice.billingAddress, 65)
    doc.text(addrLines, rightX - 70, y)
    y += (addrLines.length - 1) * 4
  }
  if (invoice.taxNumber) {
    y += 5
    doc.text(`Vergi No: ${invoice.taxNumber}`, rightX - 70, y)
  }
  if (invoice.taxOffice) {
    y += 5
    doc.text(`Vergi Dairesi: ${invoice.taxOffice}`, rightX - 70, y)
  }

  y = Math.max(y, 90) + 15

  // Tablo
  doc.setFillColor(241, 245, 249)
  doc.rect(leftMargin, y - 5, rightX - leftMargin, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Aciklama', leftMargin + 3, y + 1)
  doc.text('Donem', leftMargin + 95, y + 1)
  doc.text('Tutar', rightX - 3, y + 1, { align: 'right' })

  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)
  const planName = invoice.subscription.plan?.name ?? 'Abonelik'
  const billingCycle = invoice.subscription.billingCycle === 'annual' ? 'Yillik' : 'Aylik'
  doc.text(`${planName} - ${billingCycle} Abonelik`, leftMargin + 3, y)
  doc.text(`${formatDateTR(invoice.periodStart)} - ${formatDateTR(invoice.periodEnd)}`, leftMargin + 95, y)
  doc.text(formatCurrency(Number(invoice.amount)), rightX - 3, y, { align: 'right' })

  y += 10
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(leftMargin, y, rightX, y)

  // Toplamlar
  y += 10
  const summaryX = rightX - 60

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text('Ara Toplam:', summaryX, y)
  doc.setTextColor(30, 41, 59)
  doc.text(formatCurrency(Number(invoice.amount)), rightX - 3, y, { align: 'right' })

  y += 7
  doc.setTextColor(100, 116, 139)
  doc.text(`KDV (%${invoice.taxRate ?? 20}):`, summaryX, y)
  doc.setTextColor(30, 41, 59)
  doc.text(formatCurrency(Number(invoice.taxAmount)), rightX - 3, y, { align: 'right' })

  y += 2
  doc.setDrawColor(13, 150, 104)
  doc.setLineWidth(0.8)
  doc.line(summaryX, y, rightX, y)

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(13, 150, 104)
  doc.text('TOPLAM:', summaryX, y)
  doc.text(formatCurrency(Number(invoice.totalAmount)), rightX - 3, y, { align: 'right' })

  if (invoice.status === 'paid' && invoice.paidAt) {
    y += 15
    doc.setFillColor(220, 252, 231)
    doc.roundedRect(summaryX, y - 5, rightX - summaryX, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(22, 163, 74)
    doc.text(`ODENDI - ${formatDateTR(invoice.paidAt)}`, (summaryX + rightX) / 2, y + 1, { align: 'center' })
  }

  // Alt bilgi
  const footerY = doc.internal.pageSize.getHeight() - 20
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(leftMargin, footerY - 5, rightX, footerY - 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('Bu fatura elektronik ortamda olusturulmustur.', leftMargin, footerY)
  doc.text(`Fatura No: ${invoice.invoiceNumber}`, rightX, footerY, { align: 'right' })

  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * POST /api/admin/invoices/[id]/send
 * Faturayi e-posta ile gonderir. PDF eki ile birlikte.
 * Fatura durumunu 'sent' olarak gunceller.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  try {
    assertRole(dbUser!.role, ['admin', 'super_admin'])
  } catch {
    return errorResponse('Bu isleme yetkiniz yok', 403)
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payment: true,
        subscription: {
          include: {
            plan: true,
            organization: { select: { name: true, email: true } },
          },
        },
      },
    })

    if (!invoice) {
      return errorResponse('Fatura bulunamadi', 404)
    }

    // Organizasyon izolasyonu
    if (dbUser!.role === 'admin' && invoice.organizationId !== dbUser!.organizationId) {
      return errorResponse('Bu faturaya erisim yetkiniz yok', 403)
    }

    // E-posta adresi kontrol
    const recipientEmail = invoice.subscription.organization.email
    if (!recipientEmail) {
      return errorResponse('Organizasyonun e-posta adresi tanimli degil', 400)
    }

    // PDF olustur
    const pdfBuffer = generateInvoicePdfBuffer(invoice)

    // E-posta gonder
    await sendInvoiceEmail({
      to: recipientEmail,
      invoiceNumber: invoice.invoiceNumber,
      billingName: invoice.billingName,
      totalAmount: Number(invoice.totalAmount).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      currency: invoice.currency,
      periodStart: formatDateTR(invoice.periodStart),
      periodEnd: formatDateTR(invoice.periodEnd),
      pdfBuffer,
    })

    // Durumu guncelle
    const now = new Date()
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: now,
      },
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: invoice.organizationId,
      action: 'invoice.sent',
      entityType: 'invoice',
      entityId: invoice.id,
      newData: { invoiceNumber: invoice.invoiceNumber, sentTo: recipientEmail },
      request,
    })

    logger.info('Invoice Send', 'Fatura gonderildi', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      to: recipientEmail,
    })

    return jsonResponse({ success: true, message: 'Fatura basariyla gonderildi' })
  } catch (err) {
    logger.error('Invoice Send', 'Fatura gonderilemedi', err)
    return errorResponse('Fatura gonderilemedi. Lutfen tekrar deneyin.', 500)
  }
}
