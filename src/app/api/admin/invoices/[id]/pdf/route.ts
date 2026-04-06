import { prisma } from '@/lib/prisma'
import { getAuthUser, assertRole, errorResponse } from '@/lib/api-helpers'
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

/** Para birimi formatla: 1.234,56 TL */
function formatCurrency(amount: number, currency: string = 'TRY'): string {
  const symbol = currency === 'TRY' ? 'TL' : currency
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`
}

/**
 * GET /api/admin/invoices/[id]/pdf
 * Fatura PDF dosyasi olusturur ve dondurur.
 * jsPDF ile sunucu tarafinda PDF uretimi — Turkce karakterler icin ASCII transliterasyon kullanilir.
 */
export async function GET(
  _request: NextRequest,
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
          include: { plan: true, organization: true },
        },
      },
    })

    if (!invoice) {
      return errorResponse('Fatura bulunamadi', 404)
    }

    // Organizasyon izolasyonu — admin sadece kendi faturalarini gorebilir
    if (dbUser!.role === 'admin' && invoice.organizationId !== dbUser!.organizationId) {
      return errorResponse('Bu faturaya erisim yetkiniz yok', 403)
    }

    // PDF olustur — A4 portre
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth() // 210
    const leftMargin = 20
    const rightX = pageW - 20

    // Ust bant
    doc.setFillColor(13, 150, 104)
    doc.rect(0, 0, pageW, 40, 'F')

    // Baslik
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(255, 255, 255)
    doc.text('FATURA', leftMargin, 26)

    // Fatura numarasi (ust sag)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(invoice.invoiceNumber, rightX, 18, { align: 'right' })
    doc.setFontSize(9)
    doc.text(`Tarih: ${formatDateTR(invoice.issuedAt)}`, rightX, 25, { align: 'right' })

    const statusLabel = invoice.status === 'paid' ? 'ODENDI' : invoice.status === 'sent' ? 'GONDERILDI' : 'TASLAK'
    doc.text(`Durum: ${statusLabel}`, rightX, 32, { align: 'right' })

    let y = 55

    // Kesici bilgileri (sol)
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

    // Alici bilgileri (sag)
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

    // Donem bilgisi
    y = Math.max(y, 90) + 15

    // Tablo basligi
    doc.setFillColor(241, 245, 249)
    doc.rect(leftMargin, y - 5, rightX - leftMargin, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text('Aciklama', leftMargin + 3, y + 1)
    doc.text('Donem', leftMargin + 95, y + 1)
    doc.text('Tutar', rightX - 3, y + 1, { align: 'right' })

    // Tablo satiri
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)

    const planName = invoice.subscription.plan?.name ?? 'Abonelik'
    const billingCycle = invoice.subscription.billingCycle === 'annual' ? 'Yillik' : 'Aylik'
    doc.text(`${planName} - ${billingCycle} Abonelik`, leftMargin + 3, y)
    doc.text(`${formatDateTR(invoice.periodStart)} - ${formatDateTR(invoice.periodEnd)}`, leftMargin + 95, y)
    doc.text(formatCurrency(Number(invoice.amount)), rightX - 3, y, { align: 'right' })

    // Ayirici cizgi
    y += 10
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(leftMargin, y, rightX, y)

    // Ara toplam, KDV, Toplam
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

    // Odeme durumu badge
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

    // PDF buffer olustur
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    const fileName = `fatura-${invoice.invoiceNumber}.pdf`

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    logger.error('Invoice PDF', 'PDF olusturulamadi', err)
    return errorResponse('Fatura PDF olusturulamadi', 500)
  }
}
