import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const training = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    select: {
      title: true,
      category: true,
      startDate: true,
      endDate: true,
      assignments: {
        select: {
          status: true,
          assignedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              departmentRel: { select: { name: true } },
            },
          },
          examAttempts: {
            where: { isPassed: true },
            orderBy: { postExamCompletedAt: 'desc' },
            take: 1,
            select: {
              postExamCompletedAt: true,
              postExamScore: true,
              signedAt: true,
              signatureData: true,
              signatureMethod: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  })

  if (!training) return errorResponse('Egitim bulunamadi', 404)

  // ── PDF ──
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Başlık
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(training.title.toUpperCase(), 105, 20, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('EGITIM KATILIM VE IMZA RAPORU', 105, 28, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(100)
  const dateRange = training.startDate && training.endDate
    ? `${formatDate(training.startDate)} - ${formatDate(training.endDate)}`
    : 'Tarih belirtilmemis'
  doc.text(`Kategori: ${training.category ?? '-'}   |   Sure: ${dateRange}`, 105, 35, { align: 'center' })
  doc.text(`Olusturulma: ${new Date().toLocaleDateString('tr-TR')}`, 105, 40, { align: 'center' })
  doc.setTextColor(0)

  // Tablo verileri
  const rows = training.assignments.map((a, i) => {
    const attempt = a.examAttempts[0]
    const name = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept = [a.user.title, a.user.departmentRel?.name].filter(Boolean).join(' / ') || '-'
    const completedAt = formatDate(attempt?.postExamCompletedAt)
    const score = attempt?.postExamScore ? `%${Number(attempt.postExamScore)}` : '-'
    const signedAt = formatDate(attempt?.signedAt)
    const signStatus = attempt?.signatureMethod === 'canvas'
      ? 'El Imzasi'
      : attempt?.signatureMethod === 'acknowledge'
        ? 'Yazili Beyan'
        : 'Bekleniyor'

    return [String(i + 1), name, dept, completedAt, score, signedAt, signStatus]
  })

  autoTable(doc, {
    startY: 48,
    head: [['#', 'Ad Soyad', 'Unvan / Bolum', 'Tamamlama Tarihi', 'Puan', 'Imza Tarihi', 'Imza Durumu']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [13, 150, 104], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 247] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 38 },
      3: { cellWidth: 30 },
      4: { cellWidth: 14 },
      5: { cellWidth: 28 },
      6: { cellWidth: 27 },
    },
  })

  // İmza görselleri sayfası
  const canvasSignatures = training.assignments
    .map(a => {
      const attempt = a.examAttempts[0]
      if (!attempt || attempt.signatureMethod !== 'canvas' || !attempt.signatureData) return null
      return {
        name: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
        date: formatDate(attempt.postExamCompletedAt),
        signedAt: formatDate(attempt.signedAt),
        data: attempt.signatureData,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  if (canvasSignatures.length > 0) {
    doc.addPage()
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('IMZALAR', 105, 15, { align: 'center' })

    const SIG_W = 80
    const SIG_H = 25
    const startX = [15, 110]
    let row = 0
    let y = 25

    for (let i = 0; i < canvasSignatures.length; i++) {
      const col = i % 2
      if (col === 0 && i > 0) {
        row++
        y = 25 + row * 45
      }
      if (y + SIG_H + 15 > 275) {
        doc.addPage()
        row = 0
        y = 20
      }

      const sig = canvasSignatures[i]
      const x = startX[col]

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(sig.name, x, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100)
      doc.text(`Tamamlama: ${sig.date}`, x, y + 3.5)

      try {
        doc.addImage(sig.data, 'PNG', x, y + 5, SIG_W, SIG_H)
      } catch {
        doc.setFontSize(7)
        doc.text('[Imza gorseli yuklenemedi]', x + 10, y + 15)
      }

      doc.setDrawColor(180)
      doc.line(x, y + SIG_H + 7, x + SIG_W, y + SIG_H + 7)

      doc.setFontSize(7)
      doc.setTextColor(100)
      doc.text(`Imza Tarihi: ${sig.signedAt}`, x, y + SIG_H + 11)
      doc.setTextColor(0)
    }
  }

  // Özet footer
  const total = training.assignments.length
  const completed = training.assignments.filter(a => a.status === 'passed').length
  const signed = training.assignments.filter(a => a.examAttempts[0]?.signedAt).length

  const lastPage = doc.getNumberOfPages()
  doc.setPage(lastPage)
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    `Toplam Atanan: ${total}  |  Tamamlayan: ${completed}  |  Imzalayan: ${signed}`,
    105, 285, { align: 'center' },
  )
  doc.setTextColor(0)

  // Response
  const buffer = Buffer.from(doc.output('arraybuffer'))
  const safeName = training.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_imza_raporu.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
