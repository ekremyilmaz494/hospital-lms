import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_LABELS: Record<string, string> = {
  passed: 'Başarılı',
  failed: 'Başarısız',
  in_progress: 'Devam Ediyor',
  assigned: 'Atandı',
  locked: 'Kilitli',
}

/** Excel Tamamlama Raporu */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
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

  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  const wb = new ExcelJS.Workbook()
  wb.creator = training.organization?.name ?? 'Devakent Hastanesi'
  wb.created = new Date()

  const ws = wb.addWorksheet('Tamamlama Raporu')

  // ── Title rows ──────────────────────────────────────────
  ws.mergeCells('A1:H1')
  const titleCell = ws.getCell('A1')
  titleCell.value = training.title
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF0D9668' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  ws.mergeCells('A2:H2')
  const subtitleCell = ws.getCell('A2')
  const dateRange = (training.startDate && training.endDate)
    ? `${formatDate(training.startDate)} - ${formatDate(training.endDate)}`
    : ''
  subtitleCell.value = `${training.category ?? ''} | Baraj Puanı: %${training.passingScore} | ${dateRange}`
  subtitleCell.font = { size: 10, color: { argb: 'FF64748B' } }
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // Empty row
  ws.addRow([])

  // ── Header row ──────────────────────────────────────────
  const headers = ['#', 'Ad Soyad', 'Departman', 'Ünvan', 'Durum', 'Puan', 'Tamamlama Tarihi', 'İmza']
  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
  })

  // ── Data rows ───────────────────────────────────────────
  training.assignments.forEach((a, i) => {
    const attempt  = a.examAttempts[0]
    const name     = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept     = a.user.departmentRel?.name ?? '-'
    const title    = a.user.title ?? '-'
    const status   = STATUS_LABELS[a.status] ?? a.status
    const score    = attempt?.postExamScore ? `%${Number(attempt.postExamScore)}` : '-'
    const compDate = formatDate(a.completedAt ?? attempt?.postExamCompletedAt)
    // İmza: başarılı → boş, başarısız → X
    const sig      = a.status === 'passed' ? '' : 'X'

    const row = ws.addRow([i + 1, name, dept, title, status, score, compDate, sig])

    row.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: colNumber === 2 || colNumber === 3 || colNumber === 4 ? 'left' : 'center', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      // Alternate row background
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })

    // Status color
    const statusCell = row.getCell(5)
    if (a.status === 'passed') {
      statusCell.font = { bold: true, color: { argb: 'FF0D9668' } }
    } else if (a.status === 'failed') {
      statusCell.font = { bold: true, color: { argb: 'FFDC2626' } }
    } else {
      statusCell.font = { color: { argb: 'FFB47800' } }
    }

    // Score color
    const scoreCell = row.getCell(6)
    if (attempt?.postExamScore) {
      const scoreNum = Number(attempt.postExamScore)
      scoreCell.font = {
        bold: true,
        color: { argb: scoreNum >= training.passingScore ? 'FF0D9668' : 'FFDC2626' },
      }
    }

    // İmza X kırmızı
    if (sig === 'X') {
      row.getCell(8).font = { bold: true, color: { argb: 'FFDC2626' }, size: 12 }
    }
  })

  // ── Column widths ───────────────────────────────────────
  ws.columns = [
    { width: 5 },   // #
    { width: 25 },  // Ad Soyad
    { width: 20 },  // Departman
    { width: 18 },  // Ünvan
    { width: 15 },  // Durum
    { width: 10 },  // Puan
    { width: 18 },  // Tarih
    { width: 20 },  // İmza
  ]

  // ── Row height for signature ────────────────────────────
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 5) {
      row.height = 28
    }
  })

  // ── Note row ────────────────────────────────────────────
  ws.addRow([])
  ws.mergeCells(`A${ws.rowCount + 1}:H${ws.rowCount + 1}`)
  // Re-get the merged cell after merge
  ws.addRow([])
  const noteRowNum = ws.rowCount
  ws.mergeCells(`A${noteRowNum}:H${noteRowNum}`)
  const noteCell = ws.getCell(`A${noteRowNum}`)
  noteCell.value = '* "İmza" sütunu sadece başarılı personel tarafından imzalanacaktır.'
  noteCell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } }

  // ── Response ────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const safeName = training.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

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
