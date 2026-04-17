import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  errorResponse,
  createAuditLog,
} from '@/lib/api-helpers'
import { calculateOverallScore, type FeedbackQuestionType } from '@/lib/feedback-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * jsPDF Helvetica fontu Türkçe karakterleri desteklemediği için ASCII'ye dönüştür.
 */
const TR_MAP: Record<string, string> = {
  'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
  'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
}
function tr(text: string): string {
  return text.replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c) => TR_MAP[c] ?? c)
}

/** CSV formula injection koruması — ExcelJS hücreleri için. */
function sanitizeCell(value: unknown): string | number {
  if (typeof value === 'number') return value
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  return str
}

// Vercel serverless RAM guard — 10k satır güvenli.
const MAX_ROWS = 10_000

/**
 * GET /api/admin/feedback/responses/export
 *
 * Query:
 *   - format: "xlsx" (default) | "pdf"
 *   - trainingId, isPassed, dateFrom, dateTo — listeleme endpoint'iyle aynı filtreler
 *
 * Tüm eşleşen yanıtları (pagination'sız, MAX_ROWS cap ile) döndürür.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  if (!dbUser?.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  const roleError = requireRole(dbUser.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`feedback-export:${dbUser.organizationId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen bekleyin.', 429)

  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'xlsx'
  const trainingId = url.searchParams.get('trainingId') || undefined
  const dateFrom = url.searchParams.get('dateFrom')
  const dateTo = url.searchParams.get('dateTo')
  const isPassedParam = url.searchParams.get('isPassed')
  const isPassed = isPassedParam === 'true' ? true : isPassedParam === 'false' ? false : undefined

  const where = {
    organizationId: dbUser.organizationId,
    ...(trainingId ? { trainingId } : {}),
    ...(isPassed !== undefined ? { isPassed } : {}),
    ...(dateFrom || dateTo
      ? {
          submittedAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  }

  try {
    const [org, total, responses] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: dbUser.organizationId },
        select: { name: true },
      }),
      prisma.trainingFeedbackResponse.count({ where }),
      prisma.trainingFeedbackResponse.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: MAX_ROWS,
        select: {
          id: true,
          includeName: true,
          isPassed: true,
          submittedAt: true,
          training: { select: { id: true, title: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              departmentRel: { select: { name: true } },
            },
          },
          answers: {
            select: {
              score: true,
              item: { select: { questionType: true } },
            },
          },
        },
      }),
    ])

    const rows = responses.map(r => {
      const overall = calculateOverallScore(
        r.answers.map(a => ({
          score: a.score,
          questionType: a.item.questionType as FeedbackQuestionType,
        })),
      )
      const name = r.includeName && r.user
        ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim()
        : 'Anonim'
      return {
        submittedAt: r.submittedAt,
        trainingTitle: r.training.title,
        name,
        department: r.user?.departmentRel?.name ?? '—',
        status: r.isPassed ? 'Geçti' : 'Kaldı',
        overallScore: overall,
      }
    })

    const orgName = org?.name ?? 'Hastane'
    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    const truncated = total > MAX_ROWS

    // ── PDF ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pw = doc.internal.pageSize.getWidth()

      doc.setFontSize(16)
      doc.setTextColor(13, 150, 104)
      doc.text(tr(orgName), pw / 2, 18, { align: 'center' })
      doc.setFontSize(13)
      doc.setTextColor(30)
      doc.text(tr('Geri Bildirim Yanıtları'), pw / 2, 26, { align: 'center' })
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`${tr('Rapor Tarihi')}: ${dateLabel} — ${tr('Toplam')}: ${rows.length}${truncated ? ` / ${total}` : ''}`, pw / 2, 32, { align: 'center' })

      if (truncated) {
        doc.setTextColor(220, 38, 38)
        doc.text(tr(`Uyari: ${total} yanittan ilk ${MAX_ROWS} tanesi gosteriliyor. Filtre uygulayin.`), pw / 2, 38, { align: 'center' })
      }

      autoTable(doc, {
        startY: truncated ? 44 : 38,
        head: [[tr('Tarih'), tr('Eğitim'), tr('Katılımcı'), tr('Departman'), tr('Durum'), tr('Genel Puan')]],
        body: rows.map(r => [
          new Date(r.submittedAt).toLocaleDateString('tr-TR'),
          tr(r.trainingTitle.length > 45 ? r.trainingTitle.slice(0, 45) + '...' : r.trainingTitle),
          tr(r.name),
          tr(r.department),
          tr(r.status),
          r.overallScore !== null ? r.overallScore.toFixed(2) : '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [13, 150, 104], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 1: { cellWidth: 80 } },
        alternateRowStyles: { fillColor: [245, 248, 250] },
      })

      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        const ph = doc.internal.pageSize.getHeight()
        doc.text(`${tr(orgName)} — ${tr('Geri Bildirim Yanıtları')}`, 14, ph - 8)
        doc.text(`${tr('Sayfa')} ${i}/${totalPages}`, pw - 14, ph - 8, { align: 'right' })
      }

      const pdfBuffer = doc.output('arraybuffer')

      await createAuditLog({
        userId: dbUser.id,
        organizationId: dbUser.organizationId,
        action: 'feedback.export',
        entityType: 'export',
        entityId: dbUser.organizationId,
        newData: { format: 'pdf', count: rows.length, total },
        request,
      })

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="geri-bildirim-${dateStr}.pdf"`,
        },
      })
    }

    // ── Excel ──
    const wb = new ExcelJS.Workbook()
    wb.creator = orgName
    wb.created = new Date()

    const ws = wb.addWorksheet('Geri Bildirim')

    // Başlık satırları (mergeli)
    const titleRow = ws.addRow([`${orgName} — Geri Bildirim Yanıtları`])
    titleRow.font = { bold: true, size: 14, color: { argb: 'FF0D9668' } }
    titleRow.height = 24
    ws.mergeCells(titleRow.number, 1, titleRow.number, 6)

    const subtitleRow = ws.addRow([`Rapor Tarihi: ${dateLabel} · Toplam: ${rows.length}${truncated ? ` (ilk ${MAX_ROWS} / ${total})` : ''}`])
    subtitleRow.font = { size: 10, color: { argb: 'FF666666' } }
    ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, 6)
    ws.addRow([])

    // Kolon tanımları
    ws.columns = [
      { header: 'Tarih', key: 'submittedAt', width: 14 },
      { header: 'Eğitim', key: 'trainingTitle', width: 40 },
      { header: 'Katılımcı', key: 'name', width: 25 },
      { header: 'Departman', key: 'department', width: 20 },
      { header: 'Durum', key: 'status', width: 10 },
      { header: 'Genel Puan', key: 'overallScore', width: 12 },
    ]

    // Başlık satırı stili (columns set edildiğinde satır 1'e yazar; title satırını üste aldığımız için header manuel)
    const headerRow = ws.addRow(['Tarih', 'Eğitim', 'Katılımcı', 'Departman', 'Durum', 'Genel Puan'])
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 24

    for (const r of rows) {
      const row = ws.addRow({
        submittedAt: r.submittedAt,
        trainingTitle: sanitizeCell(r.trainingTitle),
        name: sanitizeCell(r.name),
        department: sanitizeCell(r.department),
        status: r.status,
        overallScore: r.overallScore,
      })
      // Tarih hücresini gerçek Date + format
      const dateCell = row.getCell('submittedAt')
      dateCell.numFmt = 'dd.mm.yyyy'
      dateCell.alignment = { horizontal: 'center' }

      // Status renk
      const statusCell = row.getCell('status')
      if (r.status === 'Geçti') {
        statusCell.font = { bold: true, color: { argb: 'FF16A34A' } }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      } else {
        statusCell.font = { bold: true, color: { argb: 'FFDC2626' } }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }
      }

      // Puan renk
      const scoreCell = row.getCell('overallScore')
      if (r.overallScore !== null) {
        scoreCell.numFmt = '0.00'
        scoreCell.alignment = { horizontal: 'center' }
        if (r.overallScore >= 4) scoreCell.font = { bold: true, color: { argb: 'FF16A34A' } }
        else if (r.overallScore >= 3) scoreCell.font = { bold: true, color: { argb: 'FF0D9668' } }
        else if (r.overallScore >= 2) scoreCell.font = { bold: true, color: { argb: 'FFCA8A04' } }
        else scoreCell.font = { bold: true, color: { argb: 'FFDC2626' } }
      }
    }

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: headerRow.number }]
    // AutoFilter
    ws.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: headerRow.number + rows.length, column: 6 },
    }

    const buffer = await wb.xlsx.writeBuffer()

    await createAuditLog({
      userId: dbUser.id,
      organizationId: dbUser.organizationId,
      action: 'feedback.export',
      entityType: 'export',
      entityId: dbUser.organizationId,
      newData: { format: 'xlsx', count: rows.length, total },
      request,
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="geri-bildirim-${dateStr}.xlsx"`,
      },
    })
  } catch (err) {
    logger.error('AdminFeedbackResponsesExport', 'Export hatası', { err, userId: dbUser.id })
    return errorResponse('Dışa aktarma sırasında hata oluştu', 500)
  }
}
