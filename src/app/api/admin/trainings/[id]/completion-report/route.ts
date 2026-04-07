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

/** ASCII transliteration for jsPDF Helvetica (no Turkish char support) */
function tr(text: string): string {
  return text
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
}

const PRIMARY    = [13, 150, 104] as [number, number, number]
const PRIMARY_DK = [6, 95, 70]   as [number, number, number]
const SURFACE    = [248, 250, 252] as [number, number, number]
const TEXT_MUT   = [100, 116, 139] as [number, number, number]
const TEXT_MAIN  = [15, 23, 42]   as [number, number, number]
const SUCCESS_BG = [220, 252, 231] as [number, number, number]
const ERROR_BG   = [254, 226, 226] as [number, number, number]
const WARN_BG    = [254, 243, 199] as [number, number, number]
const INFO_BG    = [239, 246, 255] as [number, number, number]
const WHITE      = [255, 255, 255] as [number, number, number]

const STATUS_MAP: Record<string, { label: string; bg: typeof SUCCESS_BG; color: typeof PRIMARY }> = {
  passed:      { label: 'Basarili',       bg: SUCCESS_BG, color: PRIMARY },
  failed:      { label: 'Basarisiz',      bg: ERROR_BG,   color: [220, 38, 38] as [number, number, number] },
  in_progress: { label: 'Devam Ediyor',   bg: WARN_BG,    color: [180, 120, 0] as [number, number, number] },
  assigned:    { label: 'Atandi',         bg: INFO_BG,    color: [37, 99, 235] as [number, number, number] },
  locked:      { label: 'Kilitli',        bg: ERROR_BG,   color: [220, 38, 38] as [number, number, number] },
}

/** PDF Tamamlama Raporu — personel listesi + imza alanlari */
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
      passingScore: true,
      startDate: true,
      endDate: true,
      organization: { select: { name: true } },
      assignments: {
        select: {
          status: true,
          completedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              title: true,
              departmentRel: { select: { name: true } },
            },
          },
          examAttempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
            select: {
              postExamScore: true,
              postExamCompletedAt: true,
              isPassed: true,
            },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  })

  if (!training) return errorResponse('Egitim bulunamadi', 404)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const orgName = training.organization?.name ?? 'Hastane LMS'

  // ── HEADER ──────────────────────────────────────────────
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 52, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 48, W, 4, 'F')

  // Logo circle
  doc.setFillColor(...WHITE)
  doc.circle(20, 22, 10, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(20, 22, 8, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('H', 20, 26, { align: 'center' })

  // Header text
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(tr(orgName).toUpperCase(), 34, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const titleLines = doc.splitTextToSize(tr(training.title), 130)
  doc.text(titleLines, 34, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 240, 220)
  doc.text('EGITIM TAMAMLAMA RAPORU', 34, 24 + titleLines.length * 5 + 2)

  // Date top-right
  doc.setTextColor(200, 240, 220)
  doc.setFontSize(7)
  doc.text(`Olusturulma: ${formatDateLong(new Date())}`, W - 10, 12, { align: 'right' })

  // ── INFO BAND ───────────────────────────────────────────
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
    { label: 'KATEGORI', value: tr(training.category ?? '-') },
    { label: 'EGITIM SURESI', value: dateRange },
    { label: 'BARAJ PUANI', value: `%${training.passingScore}` },
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

  // ── STAT CARDS ──────────────────────────────────────────
  const total      = training.assignments.length
  const passedCnt  = training.assignments.filter(a => a.status === 'passed').length
  const failedCnt  = training.assignments.filter(a => a.status === 'failed').length
  const ongoingCnt = training.assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length

  const statY = infoY + 24
  const statCards = [
    { label: 'Toplam',       value: String(total),      bg: INFO_BG,    color: [37, 99, 235] as [number, number, number] },
    { label: 'Basarili',     value: String(passedCnt),   bg: SUCCESS_BG, color: PRIMARY },
    { label: 'Basarisiz',    value: String(failedCnt),   bg: ERROR_BG,   color: [220, 38, 38] as [number, number, number] },
    { label: 'Devam Ediyor', value: String(ongoingCnt),  bg: WARN_BG,    color: [180, 120, 0] as [number, number, number] },
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

  // ── TABLE TITLE ─────────────────────────────────────────
  const tableHeaderY = statY + 24
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, tableHeaderY, W - 20, 7, 1, 1, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text('PERSONEL TAMAMLAMA LISTESI', W / 2, tableHeaderY + 5, { align: 'center' })

  // ── TABLE ───────────────────────────────────────────────
  const SIG_COL_W = 30
  const rows = training.assignments.map((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = tr(`${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim())
    const dept     = tr(a.user.departmentRel?.name ?? '-')
    const title    = tr(a.user.title ?? '-')
    const st       = STATUS_MAP[a.status] ?? STATUS_MAP.assigned
    const score    = attempt?.postExamScore ? `%${Number(attempt.postExamScore)}` : '-'
    const compDate = formatDate(a.completedAt ?? attempt?.postExamCompletedAt)
    // İmza kolonu: başarılı → boş (imzalayacak), başarısız/diğer → X
    const sigField = a.status === 'passed' ? '' : 'X'

    return [String(i + 1), name, dept, title, st.label, score, compDate, sigField]
  })

  autoTable(doc, {
    startY: tableHeaderY + 8,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Departman', 'Unvan', 'Durum', 'Puan', 'Tarih', 'Imza']],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
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
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: SIG_COL_W, halign: 'center', minCellHeight: 12 },
    },
    didParseCell(data) {
      // Color-code status
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw)
        const entry = Object.values(STATUS_MAP).find(s => s.label === val)
        if (entry) {
          data.cell.styles.textColor = entry.color
          data.cell.styles.fontStyle = 'bold'
        }
      }
      // Color-code score
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== '-') {
        const score = parseInt(String(data.cell.raw).replace('%', ''))
        if (score >= training.passingScore) {
          data.cell.styles.textColor = PRIMARY
        } else {
          data.cell.styles.textColor = [220, 38, 38]
        }
        data.cell.styles.fontStyle = 'bold'
      }
      // İmza kolonu X ise kırmızı
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === 'X') {
          data.cell.styles.textColor = [220, 38, 38]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 10
        }
      }
    },
    didDrawCell(data) {
      // Başarılı personel için boş imza kutusu çiz
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === '') {
          const cellX = data.cell.x
          const cellY = data.cell.y
          const cellW2 = data.cell.width
          const cellH = data.cell.height
          const boxW = Math.min(cellW2 - 4, 26)
          const boxH = Math.min(cellH - 3, 8)
          const bx = cellX + (cellW2 - boxW) / 2
          const by = cellY + (cellH - boxH) / 2
          doc.setDrawColor(180, 180, 180)
          doc.setLineWidth(0.3)
          doc.rect(bx, by, boxW, boxH, 'S')
        }
      }
    },
  })

  // ── FOOTER NOTE ─────────────────────────────────────────
  const finalY = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? H - 40
  const noteY = finalY + 8
  if (noteY < H - 25) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text('* "Imza" sutunu sadece basarili personel tarafindan imzalanacaktir.', 10, noteY)
    doc.text('  Basarisiz veya devam eden personel icin "X" isareti konulmustur.', 10, noteY + 4)
  }

  // ── PAGE NUMBERS ────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...SURFACE)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(0, H - 10, W, H - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(tr(orgName), 10, H - 4)
    doc.text(tr(training.title), W / 2, H - 4, { align: 'center' })
    doc.text(`${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }

  // ── RESPONSE ────────────────────────────────────────────
  const buffer  = Buffer.from(doc.output('arraybuffer'))
  const safeName = training.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_tamamlama_raporu.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
