import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '—'
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

const STATUS_MAP: Record<string, { label: string; color: RGB }> = {
  passed:      { label: 'Başarılı',     color: PRIMARY },
  failed:      { label: 'Başarısız',    color: ERROR_FG },
  in_progress: { label: 'Devam Ediyor', color: WARN_FG },
  assigned:    { label: 'Atandı',       color: INFO_FG },
  locked:      { label: 'Kilitli',      color: ERROR_FG },
}

const C_PRIMARY    = 'FF0D9668'
const C_PRIMARY_DK = 'FF065F46'
const C_SURFACE    = 'FFF1F5F9'
const C_BORDER     = 'FFE2E8F0'
const C_TEXT_MUT   = 'FF64748B'
const C_TEXT_MAIN  = 'FF0F172A'
const C_SUCCESS_BG = 'FFDCFCE7'
const C_ERROR_BG   = 'FFFEE2E2'
const C_ERROR_FG   = 'FFDC2626'
const C_WARN_BG    = 'FFFEF3C7'
const C_WARN_FG    = 'FFB47800'
const C_INFO_BG    = 'FFEFF6FF'
const C_INFO_FG    = 'FF2563EB'
const C_WHITE      = 'FFFFFFFF'
const C_ALT_ROW    = 'FFF8FAFC'

type Tab = 'staff' | 'questions'
type Format = 'pdf' | 'excel'

interface StaffRow {
  name: string
  department: string
  status: string
  preScore: string
  postScore: string
  attempt: string
}

interface QuestionRow {
  idx: number
  text: string
  points: number
  correctAnswer: string
  totalOptions: number
}

/**
 * Admin eğitim detay sayfasındaki tab-export (Personel Durumu / Sorular).
 * Query: ?tab=staff|questions&format=pdf|excel
 */
export const GET = withAdminRoute<{ id: string }>(async ({ request, params, dbUser, organizationId }) => {
  const { id } = params

  const url = new URL(request.url)
  const tab = (url.searchParams.get('tab') ?? 'staff') as Tab
  const format = (url.searchParams.get('format') ?? 'pdf') as Format
  if (!['staff', 'questions'].includes(tab)) return errorResponse('Geçersiz tab', 400)
  if (!['pdf', 'excel'].includes(format)) return errorResponse('Geçersiz format', 400)

  const allowed = await checkRateLimit(`report:tab:${dbUser.id}`, 10, 60)
  if (!allowed) return errorResponse('Çok fazla rapor isteği. Lütfen bekleyin.', 429)

  try {
    const training = await prisma.training.findFirst({
      where: { id, organizationId: organizationId },
      select: {
        title: true,
        category: true,
        passingScore: true,
        startDate: true,
        endDate: true,
        regulatoryBody: true,
        isCompulsory: true,
        organization: { select: { name: true } },
      },
    })
    if (!training) return errorResponse('Eğitim bulunamadı', 404)

    const orgName = training.organization?.name ?? 'Devakent Hastanesi'

    const docRef = id.slice(0, 8).toUpperCase()

    if (tab === 'staff') {
      const [staffRows, assignments] = await Promise.all([
        loadStaffRows(id),
        prisma.trainingAssignment.findMany({
          where: { trainingId: id },
          select: { status: true },
        }),
      ])
      return format === 'pdf'
        ? buildStaffPDF(training, orgName, staffRows, assignments, docRef)
        : buildStaffExcel(training, orgName, staffRows, assignments)
    } else {
      const questionRows = await loadQuestionRows(id)
      return format === 'pdf'
        ? buildQuestionsPDF(training, orgName, questionRows, docRef)
        : buildQuestionsExcel(training, orgName, questionRows)
    }
  } catch (err) {
    logger.error('TabExport', 'Export oluşturulamadı', err)
    return errorResponse('Rapor oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })

async function loadStaffRows(trainingId: string): Promise<StaffRow[]> {
  const rows = await prisma.trainingAssignment.findMany({
    where: { trainingId },
    select: {
      status: true,
      currentAttempt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          departmentRel: { select: { name: true } },
        },
      },
      examAttempts: {
        orderBy: { attemptNumber: 'desc' },
        take: 1,
        select: { preExamScore: true, postExamScore: true },
      },
    },
    orderBy: [
      { user: { lastName: 'asc' } },
      { user: { firstName: 'asc' } },
    ],
  })

  return rows.map((r) => {
    const a = r.examAttempts[0]
    return {
      name: `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim(),
      department: r.user.departmentRel?.name ?? '—',
      status: r.status,
      preScore: a?.preExamScore != null ? `%${Number(a.preExamScore)}` : '—',
      postScore: a?.postExamScore != null ? `%${Number(a.postExamScore)}` : '—',
      attempt: String(r.currentAttempt ?? 0),
    }
  })
}

async function loadQuestionRows(trainingId: string): Promise<QuestionRow[]> {
  const rows = await prisma.question.findMany({
    where: { trainingId },
    select: {
      questionText: true,
      points: true,
      sortOrder: true,
      options: {
        select: { optionText: true, isCorrect: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return rows.map((q, i) => ({
    idx: i + 1,
    text: q.questionText,
    points: q.points,
    correctAnswer: q.options.find((o) => o.isCorrect)?.optionText ?? '—',
    totalOptions: q.options.length,
  }))
}

type TrainingMeta = {
  title: string
  category: string | null
  passingScore: number
  startDate: Date | null
  endDate: Date | null
  regulatoryBody: string | null
  isCompulsory: boolean
}

// ════════════════ PDF: Staff ════════════════
async function buildStaffPDF(
  training: TrainingMeta,
  orgName: string,
  rows: StaffRow[],
  assignments: { status: string }[],
  docRef: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  drawHeader(doc, W, orgName, training, 'PERSONEL DURUMU RAPORU', docRef)
  const infoBottom = drawInfoBand(doc, W, training)
  const statsBottom = drawStaffStats(doc, W, infoBottom + 4, assignments)
  drawTableTitle(doc, W, statsBottom + 4, 'PERSONEL DURUMU')

  const tableRows = rows.map((r, i) => {
    const st = STATUS_MAP[r.status] ?? STATUS_MAP.assigned
    return [String(i + 1), r.name, r.department, st.label, r.preScore, r.postScore, r.attempt]
  })

  autoTable(doc, {
    startY: statsBottom + 13,
    margin: { left: 10, right: 10 },
    head: [['#', 'Ad Soyad', 'Departman', 'Durum', 'Ön Sınav', 'Son Sınav', 'Deneme']],
    body: tableRows,
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 8.5,
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
      fontSize: 8,
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', cellPadding: { top: 3.5, bottom: 3.5, left: 1, right: 1 } },
      1: { cellWidth: 60 },
      2: { cellWidth: 48 },
      3: { cellWidth: 38, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 32, halign: 'center' },
      6: { cellWidth: 30, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section !== 'body') return
      if (data.column.index === 3) {
        const val = String(data.cell.raw)
        const entry = Object.values(STATUS_MAP).find((s) => s.label === val)
        if (entry) {
          data.cell.styles.textColor = entry.color
          data.cell.styles.fontStyle = 'bold'
        }
      }
      if ((data.column.index === 4 || data.column.index === 5) && data.cell.raw !== '—') {
        const score = parseInt(String(data.cell.raw).replace('%', ''))
        data.cell.styles.textColor = score >= training.passingScore ? PRIMARY : ERROR_FG
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  drawPageFooter(doc, W, H, orgName, training.title)
  return pdfResponse(doc, training.title, 'personel_durumu')
}

// ════════════════ PDF: Questions ════════════════
async function buildQuestionsPDF(
  training: TrainingMeta,
  orgName: string,
  rows: QuestionRow[],
  docRef: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  drawHeader(doc, W, orgName, training, 'SINAV SORULARI RAPORU', docRef)
  const infoBottom = drawInfoBand(doc, W, training)

  // Questions summary stat band
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  const statY = infoBottom + 6
  const statCards = [
    { label: 'TOPLAM SORU',    value: String(rows.length),    bg: INFO_BG,    color: INFO_FG },
    { label: 'TOPLAM PUAN',    value: String(totalPoints),    bg: SUCCESS_BG, color: PRIMARY },
    { label: 'BARAJ PUANI',    value: `%${training.passingScore}`, bg: WARN_BG, color: WARN_FG },
  ]
  const cardW = (W - 20 - 4) / statCards.length
  statCards.forEach((c, i) => {
    const cx = 10 + i * (cardW + 2)
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, statY, cardW, 16, 2, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + cardW / 2, statY + 9, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + cardW / 2, statY + 14, { align: 'center' })
  })

  drawTableTitle(doc, W, statY + 20, 'SORU LİSTESİ')

  autoTable(doc, {
    startY: statY + 29,
    margin: { left: 10, right: 10 },
    head: [['#', 'Soru Metni', 'Doğru Cevap', 'Puan']],
    body: rows.map((r) => [String(r.idx), r.text, r.correctAnswer, String(r.points)]),
    styles: {
      font: TURKISH_FONT_FAMILY,
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: TEXT_MAIN,
      valign: 'middle',
    },
    headStyles: {
      font: TURKISH_FONT_FAMILY,
      fillColor: [241, 245, 249],
      textColor: TEXT_MUT,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', cellPadding: { top: 4, bottom: 4, left: 1, right: 1 } },
      1: { cellWidth: 91 },
      2: { cellWidth: 70, textColor: PRIMARY, fontStyle: 'bold' },
      3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
    },
  })

  drawPageFooter(doc, W, H, orgName, training.title)
  return pdfResponse(doc, training.title, 'sorular')
}

// ════════════════ Excel: Staff ════════════════
async function buildStaffExcel(
  training: TrainingMeta,
  orgName: string,
  rows: StaffRow[],
  assignments: { status: string }[],
) {
  const wb = createWorkbook(orgName)
  const ws = wb.addWorksheet('Personel Durumu', {
    views: [{ state: 'frozen', ySplit: 8 }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddHeader: `&L&"Calibri,Bold"&10${escapeHF(orgName)}&C&"Calibri,Regular"&9${escapeHF(training.title)}&R&9&D`,
      oddFooter: `&L&9${escapeHF(orgName)}&C&9Sayfa &P / &N&R&9Personel Durumu`,
    },
  })

  ws.columns = [
    { width: 5 }, { width: 28 }, { width: 22 }, { width: 18 },
    { width: 14 }, { width: 14 }, { width: 10 },
  ]

  buildBrandedHeader(ws, training, orgName, 7)

  // Stat cards
  const total      = assignments.length
  const passedCnt  = assignments.filter((a) => a.status === 'passed').length
  const failedCnt  = assignments.filter((a) => a.status === 'failed').length
  const ongoingCnt = assignments.filter((a) => a.status === 'in_progress' || a.status === 'assigned').length
  const completionRate = total > 0 ? Math.round((passedCnt / total) * 100) : 0
  writeStatCards(ws, 7, [
    { label: 'TOPLAM',   value: String(total),                bg: C_INFO_BG,    fg: C_INFO_FG,   colSpan: 1 },
    { label: 'BAŞARILI', value: String(passedCnt),            bg: C_SUCCESS_BG, fg: C_PRIMARY,   colSpan: 1 },
    { label: 'BAŞARISIZ', value: String(failedCnt),           bg: C_ERROR_BG,   fg: C_ERROR_FG,  colSpan: 1 },
    { label: 'DEVAM',    value: String(ongoingCnt),           bg: C_WARN_BG,    fg: C_WARN_FG,   colSpan: 2 },
    { label: 'ORAN',     value: `%${completionRate}`,         bg: C_SURFACE,    fg: C_TEXT_MAIN, colSpan: 2 },
  ])

  // Header row 8
  const headers = ['#', 'Ad Soyad', 'Departman', 'Durum', 'Ön Sınav', 'Son Sınav', 'Deneme']
  writeHeaderRow(ws, 8, headers)

  // Data rows
  rows.forEach((r, i) => {
    const st = STATUS_MAP[r.status] ?? STATUS_MAP.assigned
    const row = ws.addRow([i + 1, r.name, r.department, st.label, r.preScore, r.postScore, r.attempt])
    row.height = 22
    styleDataRow(row, i, headers.length, [2, 3])

    const statusCell = row.getCell(4)
    applyStatusBadge(statusCell, r.status)

    const preScoreCell = row.getCell(5)
    if (r.preScore !== '—') applyScoreColor(preScoreCell, r.preScore, training.passingScore)
    const postScoreCell = row.getCell(6)
    if (r.postScore !== '—') applyScoreColor(postScoreCell, r.postScore, training.passingScore)
  })

  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8 + rows.length, column: 7 } }

  return excelResponse(await wb.xlsx.writeBuffer(), training.title, 'personel_durumu')
}

// ════════════════ Excel: Questions ════════════════
async function buildQuestionsExcel(
  training: TrainingMeta,
  orgName: string,
  rows: QuestionRow[],
) {
  const wb = createWorkbook(orgName)
  const ws = wb.addWorksheet('Sorular', {
    views: [{ state: 'frozen', ySplit: 8 }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddHeader: `&L&"Calibri,Bold"&10${escapeHF(orgName)}&C&"Calibri,Regular"&9${escapeHF(training.title)}&R&9&D`,
      oddFooter: `&L&9${escapeHF(orgName)}&C&9Sayfa &P / &N&R&9Sınav Soruları`,
    },
  })

  ws.columns = [{ width: 5 }, { width: 80 }, { width: 50 }, { width: 10 }]
  buildBrandedHeader(ws, training, orgName, 4)

  // Stat cards (3 wide over 4 cols)
  const totalPoints = rows.reduce((s, r) => s + r.points, 0)
  writeStatCards(ws, 4, [
    { label: 'TOPLAM SORU', value: String(rows.length),   bg: C_INFO_BG,    fg: C_INFO_FG,  colSpan: 1 },
    { label: 'TOPLAM PUAN', value: String(totalPoints),   bg: C_SUCCESS_BG, fg: C_PRIMARY,  colSpan: 1 },
    { label: 'BARAJ',       value: `%${training.passingScore}`, bg: C_WARN_BG, fg: C_WARN_FG, colSpan: 2 },
  ])

  const headers = ['#', 'Soru Metni', 'Doğru Cevap', 'Puan']
  writeHeaderRow(ws, 8, headers)

  rows.forEach((r, i) => {
    const row = ws.addRow([r.idx, r.text, r.correctAnswer, r.points])
    row.height = 28
    styleDataRow(row, i, headers.length, [2, 3])
    row.getCell(3).font = { bold: true, size: 10, color: { argb: C_PRIMARY }, name: 'Calibri' }
    row.getCell(4).font = { bold: true, size: 10, color: { argb: C_TEXT_MAIN }, name: 'Calibri' }
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
  })

  ws.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8 + rows.length, column: 4 } }

  return excelResponse(await wb.xlsx.writeBuffer(), training.title, 'sorular')
}

// ════════════════ Shared PDF helpers ════════════════
function drawHeader(
  doc: jsPDF,
  W: number,
  orgName: string,
  training: TrainingMeta,
  subtitle: string,
  docRef: string,
) {
  // Main band
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 46, 'F')

  // Diagonal accent
  doc.setFillColor(10, 122, 85)
  doc.triangle(W - 60, 0, W, 0, W, 28, 'F')

  // Double accent stripes
  doc.setFillColor(...PRIMARY_DK)
  doc.rect(0, 42, W, 2.5, 'F')
  doc.setFillColor(245, 158, 11)
  doc.rect(0, 44.5, W, 1.5, 'F')

  // Logo — concentric discs
  doc.setFillColor(...WHITE)
  doc.circle(20, 22, 10, 'F')
  doc.setFillColor(...PRIMARY_DK)
  doc.circle(20, 22, 8, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(13)
  doc.text(orgName.charAt(0).toUpperCase(), 20, 25.5, { align: 'center' })

  // Vertical separator
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(34, 12, 34, 33)

  // Organization name
  doc.setTextColor(200, 240, 220)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(7.5)
  doc.text(orgName.toUpperCase(), 38, 14.5)

  // Training title
  doc.setTextColor(...WHITE)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(13.5)
  const titleLines = doc.splitTextToSize(training.title, W - 110)
  doc.text(titleLines, 38, 22)

  // Subtitle pill
  const pillY = 22 + titleLines.length * 5 + 1
  doc.setFontSize(7)
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  const pillW = doc.getTextWidth(subtitle) + 7
  doc.setFillColor(6, 95, 70)
  doc.roundedRect(38, pillY, pillW, 5.2, 2.6, 2.6, 'F')
  doc.setTextColor(200, 240, 220)
  doc.text(subtitle, 38 + pillW / 2, pillY + 3.6, { align: 'center' })

  // Top-right metadata
  doc.setTextColor(200, 240, 220)
  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.5)
  doc.text('BELGE NO', W - 10, 10, { align: 'right' })
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...WHITE)
  doc.text(`#${docRef}`, W - 10, 14, { align: 'right' })

  doc.setFont(TURKISH_FONT_FAMILY, 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(200, 240, 220)
  doc.text('OLUŞTURULMA', W - 10, 20, { align: 'right' })
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text(formatDateLong(new Date()), W - 10, 23.8, { align: 'right' })

  if (training.isCompulsory) {
    doc.setFillColor(245, 158, 11)
    doc.roundedRect(W - 44, 27.5, 34, 6.5, 3.25, 3.25, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(7)
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.text('★ ZORUNLU EĞİTİM', W - 27, 31.8, { align: 'center' })
  }
}

function drawInfoBand(doc: jsPDF, W: number, training: TrainingMeta): number {
  const infoY = 50
  doc.setFillColor(...SURFACE)
  doc.rect(0, infoY, W, 16, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(0, infoY, W, infoY)
  doc.line(0, infoY + 16, W, infoY + 16)

  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} — ${formatDate(training.endDate)}`
    : 'Belirtilmemiş'
  const cols = [
    { label: 'KATEGORİ',      value: training.category ?? '—' },
    { label: 'EĞİTİM SÜRESİ', value: dateRange },
    { label: 'BARAJ PUANI',   value: `%${training.passingScore}` },
    { label: 'MEVZUAT',       value: training.regulatoryBody ?? '—' },
  ]
  const colW = W / cols.length
  cols.forEach((col, i) => {
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
    if (i < cols.length - 1) {
      doc.setDrawColor(...BORDER)
      doc.setLineWidth(0.3)
      doc.line(colW * (i + 1), infoY + 3, colW * (i + 1), infoY + 13)
    }
  })
  return infoY + 16
}

function drawStaffStats(
  doc: jsPDF,
  W: number,
  y: number,
  assignments: { status: string }[],
): number {
  const total      = assignments.length
  const passedCnt  = assignments.filter((a) => a.status === 'passed').length
  const failedCnt  = assignments.filter((a) => a.status === 'failed').length
  const ongoingCnt = assignments.filter((a) => a.status === 'in_progress' || a.status === 'assigned').length
  const completionRate = total > 0 ? Math.round((passedCnt / total) * 100) : 0

  const cards = [
    { label: 'TOPLAM ATANAN', value: String(total),        bg: INFO_BG,    color: INFO_FG },
    { label: 'BAŞARILI',      value: String(passedCnt),    bg: SUCCESS_BG, color: PRIMARY },
    { label: 'BAŞARISIZ',     value: String(failedCnt),    bg: ERROR_BG,   color: ERROR_FG },
    { label: 'DEVAM EDİYOR',  value: String(ongoingCnt),   bg: WARN_BG,    color: WARN_FG },
    { label: 'TAMAMLAMA',     value: `%${completionRate}`, bg: SURFACE,    color: TEXT_MAIN },
  ]
  const gap = 2
  const cardW = (W - 20 - gap * (cards.length - 1)) / cards.length
  const cardH = 16
  cards.forEach((c, i) => {
    const cx = 10 + i * (cardW + gap)
    doc.setFillColor(...c.bg)
    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F')
    doc.setFont(TURKISH_FONT_FAMILY, 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...c.color)
    doc.text(c.value, cx + cardW / 2, y + 9, { align: 'center' })
    doc.setFont(TURKISH_FONT_FAMILY, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...TEXT_MUT)
    doc.text(c.label, cx + cardW / 2, y + 14, { align: 'center' })
  })
  return y + cardH
}

function drawTableTitle(doc: jsPDF, W: number, y: number, label: string) {
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(10, y, W - 20, 7, 1, 1, 'F')
  doc.setFont(TURKISH_FONT_FAMILY, 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...WHITE)
  doc.text(label, W / 2, y + 4.7, { align: 'center' })
}

function drawPageFooter(doc: jsPDF, W: number, H: number, orgName: string, title: string) {
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
    doc.text(title, W / 2, H - 4, { align: 'center' })
    doc.text(`Sayfa ${p} / ${totalPages}`, W - 10, H - 4, { align: 'right' })
  }
}

function pdfResponse(doc: jsPDF, title: string, kind: string): Response {
  const buffer = Buffer.from(doc.output('arraybuffer'))
  const safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safe}_${kind}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

// ════════════════ Shared Excel helpers ════════════════
function createWorkbook(orgName: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = orgName
  wb.company = orgName
  wb.created = new Date()
  return wb
}

function escapeHF(s: string): string {
  return s.replace(/&/g, '&&')
}

function buildBrandedHeader(ws: ExcelJS.Worksheet, training: TrainingMeta, orgName: string, cols: number) {
  const lastCol = String.fromCharCode(64 + cols) // 7→'G', 4→'D'
  ws.mergeCells(`A1:${lastCol}1`)
  const t = ws.getCell('A1')
  t.value = training.title
  t.font = { bold: true, size: 18, color: { argb: C_WHITE }, name: 'Calibri' }
  t.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY } }
  ws.getRow(1).height = 34

  const splitCol = Math.ceil(cols / 2)
  const splitColLetter = String.fromCharCode(64 + splitCol)
  const startCol2 = String.fromCharCode(64 + splitCol + 1)
  ws.mergeCells(`A2:${splitColLetter}2`)
  const org = ws.getCell('A2')
  org.value = orgName.toUpperCase()
  org.font = { bold: true, size: 9, color: { argb: C_WHITE }, name: 'Calibri' }
  org.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  org.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY_DK } }

  ws.mergeCells(`${startCol2}2:${lastCol}2`)
  const date = ws.getCell(`${startCol2}2`)
  date.value = `Oluşturulma: ${formatDateLong(new Date())}`
  date.font = { size: 9, color: { argb: C_WHITE }, name: 'Calibri' }
  date.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
  date.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY_DK } }
  ws.getRow(2).height = 18

  // Info band (row 3 labels, row 4 values)
  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} — ${formatDate(training.endDate)}`
    : 'Belirtilmemiş'
  const infos = [
    ['KATEGORİ', training.category ?? '—'],
    ['EĞİTİM SÜRESİ', dateRange],
    ['BARAJ', `%${training.passingScore}`],
    ['MEVZUAT', training.regulatoryBody ?? '—'],
  ]
  writeInfoBand(ws, infos, cols, 3)
}

function writeInfoBand(ws: ExcelJS.Worksheet, infos: string[][], cols: number, startRow: number) {
  // 4 info cells across cols — compute col ranges
  const segCount = infos.length
  const segSize = Math.floor(cols / segCount)
  const remainder = cols - segSize * segCount
  const ranges: [number, number][] = []
  let c = 1
  for (let i = 0; i < segCount; i++) {
    const size = segSize + (i < remainder ? 1 : 0)
    ranges.push([c, c + size - 1])
    c += size
  }

  infos.forEach(([label, value], i) => {
    const [from, to] = ranges[i]
    const fromL = String.fromCharCode(64 + from)
    const toL = String.fromCharCode(64 + to)

    if (from !== to) ws.mergeCells(`${fromL}${startRow}:${toL}${startRow}`)
    const lc = ws.getCell(`${fromL}${startRow}`)
    lc.value = label
    lc.font = { bold: true, size: 8, color: { argb: C_TEXT_MUT }, name: 'Calibri' }
    lc.alignment = { horizontal: 'center', vertical: 'middle' }
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
    lc.border = {
      top: { style: 'thin', color: { argb: C_BORDER } },
      right: i < segCount - 1 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
    }

    if (from !== to) ws.mergeCells(`${fromL}${startRow + 1}:${toL}${startRow + 1}`)
    const vc = ws.getCell(`${fromL}${startRow + 1}`)
    vc.value = value
    vc.font = { bold: true, size: 11, color: { argb: C_TEXT_MAIN }, name: 'Calibri' }
    vc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
    vc.border = {
      bottom: { style: 'thin', color: { argb: C_BORDER } },
      right: i < segCount - 1 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
    }
  })
  ws.getRow(startRow).height = 16
  ws.getRow(startRow + 1).height = 22
}

function writeStatCards(
  ws: ExcelJS.Worksheet,
  totalCols: number,
  cards: Array<{ label: string; value: string; bg: string; fg: string; colSpan: number }>,
) {
  // Stat label row = 5, value row = 6
  let currentCol = 1
  cards.forEach((card) => {
    const from = currentCol
    const to = currentCol + card.colSpan - 1
    const fromL = String.fromCharCode(64 + from)
    const toL = String.fromCharCode(64 + to)

    if (from !== to) ws.mergeCells(`${fromL}5:${toL}5`)
    const lc = ws.getCell(`${fromL}5`)
    lc.value = card.label
    lc.font = { bold: true, size: 8, color: { argb: C_TEXT_MUT }, name: 'Calibri' }
    lc.alignment = { horizontal: 'center', vertical: 'middle' }
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } }

    if (from !== to) ws.mergeCells(`${fromL}6:${toL}6`)
    const vc = ws.getCell(`${fromL}6`)
    vc.value = card.value
    vc.font = { bold: true, size: 20, color: { argb: card.fg }, name: 'Calibri' }
    vc.alignment = { horizontal: 'center', vertical: 'middle' }
    vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } }

    currentCol = to + 1
  })
  // Pad remaining cols if any
  if (currentCol <= totalCols) {
    for (let col = currentCol; col <= totalCols; col++) {
      const L = String.fromCharCode(64 + col)
      ws.getCell(`${L}5`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
      ws.getCell(`${L}6`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
    }
  }
  ws.getRow(5).height = 14
  ws.getRow(6).height = 26
  ws.getRow(7).height = 6 // spacer
}

function writeHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, headers: string[]) {
  const row = ws.getRow(rowNum)
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: C_WHITE }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: C_PRIMARY_DK } },
      bottom: { style: 'medium', color: { argb: C_PRIMARY_DK } },
      left: { style: 'thin', color: { argb: C_PRIMARY_DK } },
      right: { style: 'thin', color: { argb: C_PRIMARY_DK } },
    }
  })
  row.height = 24
}

function styleDataRow(row: ExcelJS.Row, i: number, cols: number, leftCols: number[]) {
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    cell.font = { size: 10, color: { argb: C_TEXT_MAIN }, name: 'Calibri' }
    cell.alignment = {
      horizontal: leftCols.includes(colNumber) ? 'left' : 'center',
      vertical: 'middle',
      indent: leftCols.includes(colNumber) ? 1 : 0,
      wrapText: true,
    }
    cell.border = {
      bottom: { style: 'thin', color: { argb: C_BORDER } },
      left: colNumber === 1 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
      right: colNumber === cols ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
    }
    if (i % 2 === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ALT_ROW } }
    }
  })
}

function applyStatusBadge(cell: ExcelJS.Cell, status: string) {
  const palette: Record<string, [string, string]> = {
    passed:      [C_PRIMARY,  C_SUCCESS_BG],
    failed:      [C_ERROR_FG, C_ERROR_BG],
    locked:      [C_ERROR_FG, C_ERROR_BG],
    in_progress: [C_WARN_FG,  C_WARN_BG],
    assigned:    [C_INFO_FG,  C_INFO_BG],
  }
  const [fg, bg] = palette[status] ?? palette.assigned
  cell.font = { bold: true, size: 10, color: { argb: fg }, name: 'Calibri' }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
}

function applyScoreColor(cell: ExcelJS.Cell, scoreStr: string, passingScore: number) {
  const n = parseInt(scoreStr.replace('%', ''))
  cell.font = {
    bold: true,
    size: 10,
    color: { argb: n >= passingScore ? C_PRIMARY : C_ERROR_FG },
    name: 'Calibri',
  }
}

function excelResponse(buffer: ArrayBuffer, title: string, kind: string): Response {
  const safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safe}_${kind}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
