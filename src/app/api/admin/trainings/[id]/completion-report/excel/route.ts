import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

const STATUS_LABELS: Record<string, string> = {
  passed: 'Başarılı',
  failed: 'Başarısız',
  in_progress: 'Devam Ediyor',
  assigned: 'Atandı',
  locked: 'Kilitli',
}

// ARGB palette — Excel uses AARRGGBB
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

const COLS = 8 // A..H

/** Excel Tamamlama Raporu — kurumsal kimlikli, özet blok + personel listesi */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`report:excel:${dbUser!.id}`, 5, 60)
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

  const orgName = training.organization?.name ?? 'Devakent Hastanesi'
  const wb = new ExcelJS.Workbook()
  wb.creator = orgName
  wb.company = orgName
  wb.created = new Date()

  const ws = wb.addWorksheet('Tamamlama Raporu', {
    views: [{ state: 'frozen', ySplit: 8 }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddHeader: `&L&"Calibri,Bold"&10${orgName}&C&"Calibri,Regular"&9${training.title}&R&9&D`,
      oddFooter: `&L&9${orgName}&C&9Sayfa &P / &N&R&9Eğitim Tamamlama Raporu`,
    },
  })

  // ── Column widths ───────────────────────────────────────
  ws.columns = [
    { width: 5 },   // #
    { width: 26 },  // Ad Soyad
    { width: 22 },  // Departman
    { width: 20 },  // Ünvan
    { width: 16 },  // Durum
    { width: 10 },  // Puan
    { width: 20 },  // Tamamlama Tarihi
    { width: 22 },  // İmza
  ]

  // ── Row 1: Branded title bar ────────────────────────────
  ws.mergeCells('A1:H1')
  const titleCell = ws.getCell('A1')
  titleCell.value = training.title
  titleCell.font = { bold: true, size: 18, color: { argb: C_WHITE }, name: 'Calibri' }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY } }
  ws.getRow(1).height = 36

  // ── Row 2: Organization + generation date ───────────────
  ws.mergeCells('A2:D2')
  const orgCell = ws.getCell('A2')
  orgCell.value = orgName.toUpperCase()
  orgCell.font = { bold: true, size: 9, color: { argb: C_WHITE }, name: 'Calibri' }
  orgCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  orgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY_DK } }

  ws.mergeCells('E2:H2')
  const dateCell = ws.getCell('E2')
  dateCell.value = `Oluşturulma: ${formatDateLong(new Date())}`
  dateCell.font = { size: 9, color: { argb: C_WHITE }, name: 'Calibri' }
  dateCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
  dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY_DK } }
  ws.getRow(2).height = 18

  // ── Row 3: Info band labels ─────────────────────────────
  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} — ${formatDate(training.endDate)}`
    : 'Belirtilmemiş'

  const infoLabels = ['KATEGORİ', 'EĞİTİM SÜRESİ', 'BARAJ PUANI', 'MEVZUAT']
  const infoValues = [
    training.category ?? '—',
    dateRange,
    `%${training.passingScore}`,
    training.regulatoryBody ?? '—',
  ]
  // 4 cells of equal width across 8 cols → 2 cols each
  const infoRanges: [string, string, string, string] = ['A3:B3', 'C3:D3', 'E3:F3', 'G3:H3']
  const valueRanges: [string, string, string, string] = ['A4:B4', 'C4:D4', 'E4:F4', 'G4:H4']

  infoRanges.forEach((range, i) => {
    ws.mergeCells(range)
    const c = ws.getCell(range.split(':')[0])
    c.value = infoLabels[i]
    c.font = { bold: true, size: 8, color: { argb: C_TEXT_MUT }, name: 'Calibri' }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
    c.border = {
      top: { style: 'thin', color: { argb: C_BORDER } },
      bottom: { style: 'thin', color: { argb: C_BORDER } },
      right: i < 3 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
    }
  })
  ws.getRow(3).height = 16

  valueRanges.forEach((range, i) => {
    ws.mergeCells(range)
    const c = ws.getCell(range.split(':')[0])
    c.value = infoValues[i]
    c.font = { bold: true, size: 11, color: { argb: C_TEXT_MAIN }, name: 'Calibri' }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SURFACE } }
    c.border = {
      bottom: { style: 'thin', color: { argb: C_BORDER } },
      right: i < 3 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
    }
  })
  ws.getRow(4).height = 22

  // ── Row 5-6: Stat cards ─────────────────────────────────
  const total      = training.assignments.length
  const passedCnt  = training.assignments.filter(a => a.status === 'passed').length
  const failedCnt  = training.assignments.filter(a => a.status === 'failed').length
  const ongoingCnt = training.assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length
  const completionRate = total > 0 ? Math.round((passedCnt / total) * 100) : 0

  const stats: Array<{ label: string; value: string; bg: string; fg: string }> = [
    { label: 'TOPLAM ATANAN', value: String(total),               bg: C_INFO_BG,    fg: C_INFO_FG },
    { label: 'BAŞARILI',      value: String(passedCnt),           bg: C_SUCCESS_BG, fg: C_PRIMARY },
    { label: 'BAŞARISIZ',     value: String(failedCnt),           bg: C_ERROR_BG,   fg: C_ERROR_FG },
    { label: 'DEVAM EDEN',    value: String(ongoingCnt),          bg: C_WARN_BG,    fg: C_WARN_FG },
    { label: 'TAMAMLAMA ORANI', value: `%${completionRate}`,      bg: C_SURFACE,    fg: C_TEXT_MAIN },
  ]

  // 5 cards across 8 cols → use cols 1-2, 3, 4, 5-6, 7-8? Better: 2,1,1,2,2 = 8. Let's do 2,2,1,1,2 which = 8. Or simplest: 4 cards merge pairs + 1 single on last? No — 5 cards. Use: A-B, C, D, E-F, G-H = 2+1+1+2+2 = 8 ✓
  const cardRanges: Array<[string, string]> = [
    ['A5:B5', 'A6:B6'],
    ['C5:C5', 'C6:C6'],
    ['D5:D5', 'D6:D6'],
    ['E5:F5', 'E6:F6'],
    ['G5:H5', 'G6:H6'],
  ]
  stats.forEach((s, i) => {
    const [labelRange, valueRange] = cardRanges[i]
    if (labelRange.includes(':') && labelRange.split(':')[0] !== labelRange.split(':')[1]) {
      ws.mergeCells(labelRange)
    }
    if (valueRange.includes(':') && valueRange.split(':')[0] !== valueRange.split(':')[1]) {
      ws.mergeCells(valueRange)
    }
    const vCell = ws.getCell(valueRange.split(':')[0])
    vCell.value = s.value
    vCell.font = { bold: true, size: 20, color: { argb: s.fg }, name: 'Calibri' }
    vCell.alignment = { horizontal: 'center', vertical: 'middle' }
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }

    const lCell = ws.getCell(labelRange.split(':')[0])
    lCell.value = s.label
    lCell.font = { bold: true, size: 8, color: { argb: C_TEXT_MUT }, name: 'Calibri' }
    lCell.alignment = { horizontal: 'center', vertical: 'middle' }
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } }
  })
  ws.getRow(5).height = 14
  ws.getRow(6).height = 26

  // ── Row 7: spacer ───────────────────────────────────────
  ws.getRow(7).height = 6

  // ── Row 8: Table header ─────────────────────────────────
  const headers = ['#', 'Ad Soyad', 'Departman', 'Ünvan', 'Durum', 'Puan', 'Tamamlama Tarihi', 'İmza']
  const headerRow = ws.getRow(8)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, size: 10, color: { argb: C_WHITE }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_PRIMARY } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top:    { style: 'thin', color: { argb: C_PRIMARY_DK } },
      bottom: { style: 'medium', color: { argb: C_PRIMARY_DK } },
      left:   { style: 'thin', color: { argb: C_PRIMARY_DK } },
      right:  { style: 'thin', color: { argb: C_PRIMARY_DK } },
    }
  })
  headerRow.height = 24

  // ── Data rows ───────────────────────────────────────────
  training.assignments.forEach((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept     = a.user.departmentRel?.name ?? '—'
    const userTitle = a.user.title ?? '—'
    const status   = STATUS_LABELS[a.status] ?? a.status
    const score    = attempt?.postExamScore != null ? `%${Number(attempt.postExamScore)}` : '—'
    const compDate = formatDate(a.completedAt ?? attempt?.postExamCompletedAt)
    const sig      = a.status === 'passed' ? '' : 'X'

    const row = ws.addRow([i + 1, name, dept, userTitle, status, score, compDate, sig])
    row.height = 22

    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10, color: { argb: C_TEXT_MAIN }, name: 'Calibri' }
      cell.alignment = {
        horizontal: colNumber === 2 || colNumber === 3 || colNumber === 4 ? 'left' : 'center',
        vertical: 'middle',
        indent: colNumber === 2 || colNumber === 3 || colNumber === 4 ? 1 : 0,
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: C_BORDER } },
        left: colNumber === 1 ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
        right: colNumber === COLS ? { style: 'thin', color: { argb: C_BORDER } } : undefined,
      }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ALT_ROW } }
      }
    })

    // Status cell: colored badge-like text
    const statusCell = row.getCell(5)
    if (a.status === 'passed') {
      statusCell.font = { bold: true, size: 10, color: { argb: C_PRIMARY }, name: 'Calibri' }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SUCCESS_BG } }
    } else if (a.status === 'failed' || a.status === 'locked') {
      statusCell.font = { bold: true, size: 10, color: { argb: C_ERROR_FG }, name: 'Calibri' }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_ERROR_BG } }
    } else if (a.status === 'in_progress') {
      statusCell.font = { bold: true, size: 10, color: { argb: C_WARN_FG }, name: 'Calibri' }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_WARN_BG } }
    } else {
      statusCell.font = { bold: true, size: 10, color: { argb: C_INFO_FG }, name: 'Calibri' }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_INFO_BG } }
    }

    // Score color
    const scoreCell = row.getCell(6)
    if (attempt?.postExamScore != null) {
      const scoreNum = Number(attempt.postExamScore)
      scoreCell.font = {
        bold: true,
        size: 10,
        color: { argb: scoreNum >= training.passingScore ? C_PRIMARY : C_ERROR_FG },
        name: 'Calibri',
      }
    }

    // Signature
    if (sig === 'X') {
      row.getCell(8).font = { bold: true, color: { argb: C_ERROR_FG }, size: 12, name: 'Calibri' }
    }
  })

  // ── AutoFilter on header ────────────────────────────────
  ws.autoFilter = {
    from: { row: 8, column: 1 },
    to:   { row: 8 + training.assignments.length, column: COLS },
  }

  // ── Note row ────────────────────────────────────────────
  const noteRowNum = ws.rowCount + 2
  ws.mergeCells(`A${noteRowNum}:H${noteRowNum}`)
  const noteCell = ws.getCell(`A${noteRowNum}`)
  noteCell.value = '* "İmza" sütunu yalnızca başarılı personel tarafından imzalanmak üzere boş bırakılmıştır. Başarısız veya devam eden personel için "X" işareti konulmuştur.'
  noteCell.font = { italic: true, size: 9, color: { argb: C_TEXT_MUT }, name: 'Calibri' }
  noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  ws.getRow(noteRowNum).height = 24

  // ── Response ────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const safeName = training.title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_tamamlama_raporu.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })

  } catch (err) {
    logger.error('CompletionReportExcel', 'Excel raporu oluşturulamadı', err)
    return errorResponse('Rapor oluşturulurken hata oluştu', 500)
  }
}
