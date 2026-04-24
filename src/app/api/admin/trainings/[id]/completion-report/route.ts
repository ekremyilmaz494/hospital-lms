import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

type RGB = [number, number, number]

const PRIMARY:    RGB = [13, 150, 104]
const PRIMARY_DK: RGB = [6, 95, 70]
const SURFACE:    RGB = [248, 250, 252]
const BORDER:     RGB = [226, 232, 240]
const TEXT_MUT:   RGB = [100, 116, 139]
const TEXT_MAIN:  RGB = [15, 23, 42]
const SUCCESS_BG: RGB = [220, 252, 231]
const ERROR_BG:   RGB = [254, 226, 226]
const ERROR_FG:   RGB = [220, 38, 38]
const WARN_BG:    RGB = [254, 243, 199]
const WARN_FG:    RGB = [180, 120, 0]
const INFO_BG:    RGB = [239, 246, 255]
const INFO_FG:    RGB = [37, 99, 235]
const WHITE:      RGB = [255, 255, 255]

const STATUS_MAP: Record<string, { label: string; bg: RGB; color: RGB }> = {
  passed:      { label: 'Başarılı',     bg: SUCCESS_BG, color: PRIMARY },
  failed:      { label: 'Başarısız',    bg: ERROR_BG,   color: ERROR_FG },
  in_progress: { label: 'Devam Ediyor', bg: WARN_BG,    color: WARN_FG },
  assigned:    { label: 'Atandı',       bg: INFO_BG,    color: INFO_FG },
  locked:      { label: 'Kilitli',      bg: ERROR_BG,   color: ERROR_FG },
}

/** PDF Tamamlama Raporu — kurumsal kimlikli personel listesi + imza alanları */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`report:pdf:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla rapor isteği. Lütfen bekleyin.', 429)

  try {

  const training = await prisma.training.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    select: {
      title: true,
      category: true,
      passingScore: true,
      startDate: true,
      endDate: true,
      regulatoryBody: true,
      isCompulsory: true,
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
        orderBy: [
          { user: { lastName: 'asc' } },
          { user: { firstName: 'asc' } },
        ],
      },
    },
  })

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const orgName = training.organization?.name ?? 'Devakent Hastanesi'

  // ── HEADER ──────────────────────────────────────────────
  // Main band
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 50, 'F')

  // Subtle diagonal accent on right edge (darker shade of primary for depth)
  doc.setFillColor(10, 122, 85)
  doc.triangle(W - 60, 0, W, 0, W, 30, 'F')

  // Bottom accent stripes (thin double line for premium feel)
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 46, W, 2.5, 'F')
  doc.setFillColor(245, 158, 11) // accent amber
  doc.rect(0, 48.5, W, 1.5, 'F')

  // Logo: outer white disc + inner dark disc with initial
  doc.setFillColor(...WHITE)
  doc.circle(21, 24, 11, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(21, 24, 9, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(14)
  doc.text(orgName.charAt(0).toUpperCase(), 21, 27.8, { align: 'center' })

  // Vertical separator after logo
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(37, 14, 37, 36)

  // Organization name — small caps uppercase
  doc.setTextColor(200, 240, 220)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(8)
  doc.text(orgName.toUpperCase(), 41, 16)

  // Training title — bold, hero
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(15)
  const titleLines = doc.splitTextToSize(training.title, W - 110)
  doc.text(titleLines, 41, 24)

  // Subtitle pill badge
  const pillY = 24 + titleLines.length * 5.5 + 1
  const pillLabel = 'EĞİTİM TAMAMLAMA RAPORU'
  doc.setFontSize(7.5)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  const pillW = doc.getTextWidth(pillLabel) + 8
  doc.setFillColor(6, 95, 70)
  doc.roundedRect(41, pillY, pillW, 5.5, 2.75, 2.75, 'F')
  doc.setTextColor(200, 240, 220)
  doc.text(pillLabel, 41 + pillW / 2, pillY + 3.8, { align: 'center' })

  // Top-right metadata block
  const docRef = id.slice(0, 8).toUpperCase()
  doc.setTextColor(200, 240, 220)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.8)
  doc.text('BELGE NO', W - 10, 10.5, { align: 'right' })
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(`#${docRef}`, W - 10, 14.5, { align: 'right' })

  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(200, 240, 220)
  doc.text('OLUŞTURULMA', W - 10, 21, { align: 'right' })
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...WHITE)
  doc.text(formatDateLong(new Date()), W - 10, 25, { align: 'right' })

  if (training.isCompulsory) {
    doc.setFillColor(245, 158, 11)
    doc.roundedRect(W - 44, 29, 34, 6.5, 3.25, 3.25, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7)
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.text('★ ZORUNLU EĞİTİM', W - 27, 33.3, { align: 'center' })
  }

  // ── INFO BAND ───────────────────────────────────────────
  const infoY = 54
  doc.setFillColor(...SURFACE)
  doc.rect(0, infoY, W, 16, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(0, infoY, W, infoY)
  doc.line(0, infoY + 16, W, infoY + 16)

  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} — ${formatDate(training.endDate)}`
    : 'Belirtilmemiş'

  const infoCols = [
    { label: 'KATEGORİ',       value: training.category ?? '—' },
    { label: 'EĞİTİM SÜRESİ',  value: dateRange },
    { label: 'BARAJ PUANI',    value: `%${training.passingScore}` },
    { label: 'MEVZUAT',        value: training.regulatoryBody ?? '—' },
  ]
  const colW = W / infoCols.length
  infoCols.forEach((col, i) => {
    const cx = colW * i + colW / 2
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(col.label, cx, infoY + 5.5, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT_MAIN)
    const truncated = doc.splitTextToSize(col.value, colW - 4)[0] as string
    doc.text(truncated, cx, infoY + 11.5, { align: 'center' })
    if (i < infoCols.length - 1) {
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.3)
      doc.line(colW * (i + 1), infoY + 3, colW * (i + 1), infoY + 13)
    }
  })

  // ── STAT CARDS ──────────────────────────────────────────
  const total      = training.assignments.length
  const passedCnt  = training.assignments.filter(a => a.status === 'passed').length
  const failedCnt  = training.assignments.filter(a => a.status === 'failed').length
  const ongoingCnt = training.assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length
  const completionRate = total > 0 ? Math.round((passedCnt / total) * 100) : 0

  const statY = infoY + 22
  const statCards = [
    { label: 'TOPLAM ATANAN',  value: String(total),               bg: INFO_BG,    color: INFO_FG },
    { label: 'BAŞARILI',       value: String(passedCnt),            bg: SUCCESS_BG, color: PRIMARY },
    { label: 'BAŞARISIZ',      value: String(failedCnt),            bg: ERROR_BG,   color: ERROR_FG },
    { label: 'DEVAM EDİYOR',   value: String(ongoingCnt),           bg: WARN_BG,    color: WARN_FG },
    { label: 'TAMAMLAMA',      value: `%${completionRate}`,         bg: SURFACE,    color: TEXT_MAIN },
  ]

  const gap = 2
  const cardW = (W - 20 - gap * (statCards.length - 1)) / statCards.length
  const cardH = 18
  statCards.forEach((c, i) => {
    const cx = 10 + i * (cardW + gap)
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, statY, cardW, cardH, 2, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + cardW / 2, statY + 10, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + cardW / 2, statY + 15, { align: 'center' })
  })

  // ── TABLE TITLE BAND ────────────────────────────────────
  const tableHeaderY = statY + cardH + 6
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, tableHeaderY, W - 20, 7, 1, 1, 'F')
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text('PERSONEL TAMAMLAMA LİSTESİ', W / 2, tableHeaderY + 4.7, { align: 'center' })

  // ── TABLE ───────────────────────────────────────────────
  const rows = training.assignments.map((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept     = a.user.departmentRel?.name ?? '—'
    const userTitle = a.user.title ?? '—'
    const st       = STATUS_MAP[a.status] ?? STATUS_MAP.assigned
    const score    = attempt?.postExamScore != null ? `%${Number(attempt.postExamScore)}` : '—'
    const compDate = formatDate(a.completedAt ?? attempt?.postExamCompletedAt)
    const sigField = a.status === 'passed' ? '' : 'X'

    return [String(i + 1), name, dept, userTitle, st.label, score, compDate, sigField]
  })

  autoTable(doc, {
    startY: tableHeaderY + 8,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Departman', 'Ünvan', 'Durum', 'Puan', 'Tarih', 'İmza']],
    body: rows,
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 7.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
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
      0: { cellWidth: 12, halign: 'center', cellPadding: { top: 3.5, bottom: 3.5, left: 1, right: 1 } },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 24, halign: 'center', minCellHeight: 11 },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw)
        const entry = Object.values(STATUS_MAP).find(s => s.label === val)
        if (entry) {
          data.cell.styles.textColor = entry.color
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== '—') {
        const score = parseInt(String(data.cell.raw).replace('%', ''))
        data.cell.styles.textColor = score >= training.passingScore ? PRIMARY : ERROR_FG
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === 'X') {
          data.cell.styles.textColor = ERROR_FG
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 10
        }
      }
    },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw)
        if (val === '') {
          const boxW = Math.min(data.cell.width - 4, 20)
          const boxH = Math.min(data.cell.height - 3, 7)
          const bx = data.cell.x + (data.cell.width - boxW) / 2
          const by = data.cell.y + (data.cell.height - boxH) / 2
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
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text('* "İmza" sütunu yalnızca başarılı personel tarafından imzalanmak üzere boş bırakılmıştır.', 10, noteY)
    doc.text('  Başarısız veya devam eden personel için "X" işareti konulmuştur.', 10, noteY + 4)
  }

  // ── PAGE FOOTER ─────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...SURFACE)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.3)
    doc.line(0, H - 10, W, H - 10)
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(orgName, 10, H - 4)
    doc.text(training.title, W / 2, H - 4, { align: 'center' })
    doc.text(`Sayfa ${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }

  // ── RESPONSE ────────────────────────────────────────────
  const buffer  = Buffer.from(doc.output('arraybuffer'))
  const safeName = training.title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_tamamlama_raporu.pdf"`,
      'Cache-Control': 'no-store',
    },
  })

  } catch (err) {
    logger.error('CompletionReportPDF', 'Rapor oluşturulamadı', err)
    return errorResponse('Rapor oluşturulurken hata oluştu', 500)
  }
}
