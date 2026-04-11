import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const PRIMARY    = [13, 150, 104] as [number, number, number]
const PRIMARY_DK = [6, 95, 70]   as [number, number, number]
const SURFACE    = [248, 250, 252] as [number, number, number]
const TEXT_MUT   = [100, 116, 139] as [number, number, number]
const TEXT_MAIN  = [15, 23, 42]   as [number, number, number]
const SUCCESS_BG = [220, 252, 231] as [number, number, number]
const WARN_BG    = [254, 243, 199] as [number, number, number]
const ERROR_BG   = [254, 226, 226] as [number, number, number]

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
      organization: { select: { name: true, logoUrl: true } },
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

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()   // 210
  const H = doc.internal.pageSize.getHeight()  // 297

  // ── HEADER BACKGROUND ──────────────────────────────────────────────
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 52, 'F')

  // Header bottom wave/accent
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 48, W, 4, 'F')

  // ── LOGO AREA (left circle) ────────────────────────────────────────
  doc.setFillColor(255, 255, 255)
  doc.circle(20, 22, 10, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(20, 22, 8, 'F')
  // H letter
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('H', 20, 26, { align: 'center' })

  // ── HEADER TEXT ────────────────────────────────────────────────────
  const orgName = training.organization?.name ?? 'Devakent Hastanesi'
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(orgName.toUpperCase(), 34, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const titleLines = doc.splitTextToSize(training.title, 130)
  doc.text(titleLines, 34, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 240, 220)
  doc.text('EGITIM KATILIM VE IMZA RAPORU', 34, 24 + titleLines.length * 5 + 2)

  // Doc date top-right
  doc.setTextColor(200, 240, 220)
  doc.setFontSize(7)
  doc.text(`Olusturulma: ${formatDateLong(new Date())}`, W - 10, 12, { align: 'right' })

  // ── INFO BAND ──────────────────────────────────────────────────────
  const infoY = 56
  doc.setFillColor(...SURFACE)
  doc.rect(0, infoY, W, 18, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(0, infoY, W, infoY)
  doc.line(0, infoY + 18, W, infoY + 18)

  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} - ${formatDate(training.endDate)}`
    : 'Belirtilmemis'

  const infoCols = [
    { label: 'KATEGORI', value: training.category ?? '-' },
    { label: 'EGITIM SURESI', value: dateRange },
    { label: 'TOPLAM ATANAN', value: String(training.assignments.length) },
  ]
  const colW = W / infoCols.length
  infoCols.forEach((col, i) => {
    const cx = colW * i + colW / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text(col.label, cx, infoY + 6, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MAIN)
    doc.text(col.value, cx, infoY + 13, { align: 'center' })
    if (i < infoCols.length - 1) {
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.line(colW * (i + 1), infoY + 3, colW * (i + 1), infoY + 15)
    }
  })

  // ── STAT CARDS ─────────────────────────────────────────────────────
  const total     = training.assignments.length
  const completed = training.assignments.filter(a => a.status === 'passed').length
  const signed    = training.assignments.filter(a => a.examAttempts[0]?.signedAt).length
  const pending   = total - signed

  const statY = infoY + 24
  const statCards = [
    { label: 'Tamamlayan', value: String(completed), bg: SUCCESS_BG, color: PRIMARY },
    { label: 'Imzalayan',  value: String(signed),    bg: SUCCESS_BG, color: PRIMARY },
    { label: 'Bekleniyor', value: String(pending),   bg: pending > 0 ? WARN_BG : SUCCESS_BG, color: pending > 0 ? [180, 120, 0] as [number,number,number] : PRIMARY },
    { label: 'Toplam',     value: String(total),     bg: [239, 246, 255] as [number,number,number], color: [37, 99, 235] as [number,number,number] },
  ]

  const cardW = (W - 20) / statCards.length
  statCards.forEach((c, i) => {
    const cx = 10 + i * cardW
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, statY, cardW - 2, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + (cardW - 2) / 2, statY + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + (cardW - 2) / 2, statY + 15.5, { align: 'center' })
  })

  // ── TABLE TITLE ────────────────────────────────────────────────────
  const tableHeaderY = statY + 24
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, tableHeaderY, W - 20, 7, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('KATILIMCI LISTESI', W / 2, tableHeaderY + 5, { align: 'center' })

  // ── TABLE ──────────────────────────────────────────────────────────
  const rows = training.assignments.map((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept     = [a.user.title, a.user.departmentRel?.name].filter(Boolean).join(' / ') || '-'
    const score    = attempt?.postExamScore ? `%${Number(attempt.postExamScore)}` : '-'
    const compDate = formatDate(attempt?.postExamCompletedAt)
    const signDate = formatDate(attempt?.signedAt)
    const signStatus = attempt?.signatureMethod === 'canvas'
      ? 'El Imzasi'
      : attempt?.signatureMethod === 'acknowledge'
        ? 'Yazili Beyan'
        : 'Bekleniyor'

    return [String(i + 1), name, dept, compDate, score, signDate, signStatus]
  })

  autoTable(doc, {
    startY: tableHeaderY + 8,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Unvan / Bolum', 'Tamamlama', 'Puan', 'Imza Tarihi', 'Imza Durumu']],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: TEXT_MAIN,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: TEXT_MUT,
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 7,  halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 38 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 28, halign: 'center' },
    },
    didParseCell(data) {
      // Color-code signature status
      if (data.section === 'body' && data.column.index === 6) {
        const val = String(data.cell.raw)
        if (val === 'El Imzasi' || val === 'Yazili Beyan') {
          data.cell.styles.textColor = PRIMARY
          data.cell.styles.fontStyle = 'bold'
        } else if (val === 'Bekleniyor') {
          data.cell.styles.textColor = [180, 120, 0]
        }
      }
      // Color-code score
      if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '-') {
        const score = parseInt(String(data.cell.raw).replace('%', ''))
        if (score >= 90) data.cell.styles.textColor = PRIMARY
        else if (score >= 70) data.cell.styles.textColor = [15, 23, 42]
        else data.cell.styles.textColor = [220, 38, 38]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ── SIGNATURE PAGE ─────────────────────────────────────────────────
  const canvasSigs = training.assignments
    .map(a => {
      const attempt = a.examAttempts[0]
      if (!attempt?.signatureData || attempt.signatureMethod !== 'canvas') return null
      return {
        name:     `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
        dept:     [a.user.title, a.user.departmentRel?.name].filter(Boolean).join(' / ') || '-',
        date:     formatDate(attempt.postExamCompletedAt),
        signedAt: formatDate(attempt.signedAt),
        data:     attempt.signatureData,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)

  if (canvasSigs.length > 0) {
    doc.addPage()

    // Signature page header
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 0, W, 20, 'F')
    doc.setFillColor(...PRIMARY_DK)
    doc.rect(0, 18, W, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text('EL IMZALARI', W / 2, 13, { align: 'center' })

    const SIG_W = 82
    const SIG_H = 26
    const cols  = [14, 112]
    let row = 0
    let y   = 28

    for (let i = 0; i < canvasSigs.length; i++) {
      const col = i % 2
      if (col === 0 && i > 0) {
        row++
        y = 28 + row * 52
      }
      if (y + SIG_H + 20 > H - 15) {
        doc.addPage()
        doc.setFillColor(...PRIMARY)
        doc.rect(0, 0, W, 20, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(255, 255, 255)
        doc.text('EL IMZALARI (devam)', W / 2, 13, { align: 'center' })
        row = 0
        y   = 28
      }

      const sig = canvasSigs[i]
      const x   = cols[col]

      // Card background
      doc.setFillColor(...SURFACE)
      doc.roundedRect(x, y, SIG_W + 2, SIG_H + 18, 2, 2, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, y, SIG_W + 2, SIG_H + 18, 2, 2, 'S')

      // Name + dept
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...TEXT_MAIN)
      doc.text(sig.name, x + 3, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...TEXT_MUT)
      doc.text(sig.dept, x + 3, y + 9.5)

      // Signature image area
      doc.setFillColor(255, 255, 255)
      doc.rect(x + 2, y + 11, SIG_W - 2, SIG_H, 'F')
      try {
        doc.addImage(sig.data, 'PNG', x + 2, y + 11, SIG_W - 2, SIG_H)
      } catch {
        doc.setFontSize(7)
        doc.setTextColor(...TEXT_MUT)
        doc.text('[Imza gorseli yuklenemedi]', x + (SIG_W / 2), y + 11 + SIG_H / 2, { align: 'center' })
      }

      // Signed date footer
      doc.setFillColor(...PRIMARY)
      doc.roundedRect(x, y + SIG_H + 11, SIG_W + 2, 6.5, 0, 0, 'F')
      doc.roundedRect(x, y + SIG_H + 11, SIG_W + 2, 6.5, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(255, 255, 255)
      doc.text(`Imzalanma: ${sig.signedAt}`, x + (SIG_W + 2) / 2, y + SIG_H + 15.5, { align: 'center' })
    }
  }

  // ── PAGE NUMBERS ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Footer bar
    doc.setFillColor(...SURFACE)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(0, H - 10, W, H - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(orgName, 10, H - 4)
    doc.text(training.title, W / 2, H - 4, { align: 'center' })
    doc.text(`${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }

  // ── RESPONSE ────────────────────────────────────────────────────────
  const buffer  = Buffer.from(doc.output('arraybuffer'))
  const safeName = training.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_imza_raporu.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
