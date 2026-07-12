import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withGroupRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { buildOrgReportFilters } from '../../../admin/reports/_shared'
import { fetchReportData, buildReportRows, truncate, type ReportRows } from '../../../admin/reports/_report-data'
import {
  BRAND_PRIMARY, COLOR_SUCCESS, COLOR_WARNING, COLOR_DANGER, COLOR_MUTED,
  COLOR_BORDER, COLOR_SURFACE_ALT, XL,
  sanitizeCell, sanitizeSheetName, addWorkbookMetadata, styleHeaderRow, applyZebraStripes,
  colorRateCell, renderCoverPage, renderChrome, renderKpiCards, renderSectionTitle,
} from '../../../admin/reports/_report-format'

/**
 * GET /api/group/reports/export?format=xlsx|pdf[&from=&to=]
 *
 * Grup yöneticisi (esas yönetici) için TÜM grup hastanelerini kapsayan BİRLEŞİK rapor.
 * Her hastane admin per-hastane export'uyla AYNI veri katmanından geçer (`fetchReportData`
 * + `buildReportRows`) → "Grup Özeti" karşılaştırma tablosu + hastane-başı detay
 * (Excel: hastane-başı sheet, PDF: hastane-başı bölüm). Departman filtresi YOK (org-özel);
 * opsiyonel grup-geneli tarih aralığı desteklenir. Her hastane kendi aktif dönemine scope'lanır.
 */

const REPORT_TITLE = 'Konsolide Eğitim Raporu'

interface HospitalReport {
  id: string
  name: string
  code: string
  activeTrainingCount: number
  rows: ReportRows
}

function rgbForRate(rate: number): [number, number, number] {
  if (rate >= 80) return COLOR_SUCCESS
  if (rate >= 60) return COLOR_WARNING
  return COLOR_DANGER
}

export const GET = withGroupRoute(async ({ request, groupId, audit }) => {
  const allowed = await checkRateLimit(`report-export:group:${groupId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') ?? 'xlsx') as 'pdf' | 'xlsx'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined
  const validFrom = dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined
  const validTo = dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined

  try {
    const group = await prisma.organizationGroup.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        logoUrl: true,
        organizations: {
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    if (!group) return errorResponse('Grup bulunamadı', 404)

    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    const filterLabel = validFrom || validTo
      ? `Filtre: ${validFrom ? validFrom.toLocaleDateString('tr-TR') : '…'} – ${validTo ? validTo.toLocaleDateString('tr-TR') : '…'}`
      : null

    // Her hastanenin verisini per-hastane export'la AYNI yoldan çek (drift yok).
    const settled = await Promise.all(
      group.organizations.map(async (o): Promise<HospitalReport | null> => {
        try {
          const filters = await buildOrgReportFilters(o.id, { dateFrom: validFrom, dateTo: validTo })
          const data = await fetchReportData(filters)
          const rows = buildReportRows(data)
          return { id: o.id, name: o.name, code: o.code, activeTrainingCount: rows.trainingRows.length, rows }
        } catch (err) {
          logger.error('group-report-export', 'Hastane raporu üretilemedi', {
            orgId: o.id,
            error: err instanceof Error ? err.message : err,
          })
          return null
        }
      }),
    )
    const hospitals = settled.filter((h): h is HospitalReport => h !== null)

    // ── Grup toplamları ──
    const totalStaff = hospitals.reduce((s, h) => s + h.rows.staffCount, 0)
    const totalTrainings = hospitals.reduce((s, h) => s + h.activeTrainingCount, 0)
    const totalAssigned = hospitals.reduce((s, h) => s + h.rows.totalAssigned, 0)
    const totalPassed = hospitals.reduce((s, h) => s + h.rows.passedCount, 0)
    const totalFailed = hospitals.reduce((s, h) => s + h.rows.failedCount, 0)
    const groupCompletionRate = totalAssigned > 0 ? Math.round((totalPassed / totalAssigned) * 100) : 0
    // Ort. Puan grup roll-up'ı: atama-ağırlıklı (hastaneler arası basit ortalama yerine).
    const weightBase = hospitals.reduce((s, h) => s + (h.rows.totalAssigned > 0 ? h.rows.totalAssigned : 0), 0)
    const groupAvgScore = weightBase > 0
      ? Math.round(hospitals.reduce((s, h) => s + h.rows.avgScore * (h.rows.totalAssigned > 0 ? h.rows.totalAssigned : 0), 0) / weightBase)
      : 0

    // ── PDF ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      await applyTurkishFont(doc)

      const coverLogo = await resolveOrgLogoDataUrl(group.logoUrl)
      // Kapak alt-bilgisi: hastane sayısı + (varsa) tarih filtresi. Kırpma uyarısı yok (null).
      const coverSubtitle = [
        `${hospitals.length} hastane`,
        filterLabel ? filterLabel.replace('Filtre: ', '') : null,
      ].filter(Boolean).join('   ·   ')
      renderCoverPage(doc, group.name, REPORT_TITLE, dateLabel, coverSubtitle, null, coverLogo)

      const tableBase = {
        theme: 'grid' as const,
        styles: { font: TURKISH_FONT_FAMILY, fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] as [number, number, number], lineColor: COLOR_BORDER, lineWidth: 0.1 },
        headStyles: { font: TURKISH_FONT_FAMILY, fontStyle: 'bold' as const, fillColor: BRAND_PRIMARY, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, halign: 'left' as const, cellPadding: 3 },
        alternateRowStyles: { fillColor: COLOR_SURFACE_ALT },
        margin: { top: 14, bottom: 14, left: 10, right: 10 },
      }

      // ── Grup özeti sayfası ──
      doc.addPage()
      let y = 18
      y = renderSectionTitle(doc, 'Grup Geneli Göstergeler', y)
      y = renderKpiCards(doc, [
        { label: 'Hastane', value: String(hospitals.length), color: BRAND_PRIMARY },
        { label: 'Toplam Personel', value: String(totalStaff), color: [59, 130, 246] },
        { label: 'Toplam Atama', value: String(totalAssigned), color: [139, 92, 246] },
        { label: 'Tamamlanma', value: `%${groupCompletionRate}`, color: COLOR_SUCCESS },
        { label: 'Ort. Puan', value: String(groupAvgScore), color: rgbForRate(groupAvgScore) },
      ], y)

      y = renderSectionTitle(doc, 'Hastane Karşılaştırması', y + 2)
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Hastane', 'Personel', 'Aktif Eğitim', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Tamamlanma']],
        body: hospitals.map(h => [
          truncate(h.name, 40), String(h.rows.staffCount), String(h.activeTrainingCount),
          String(h.rows.totalAssigned), String(h.rows.passedCount), String(h.rows.failedCount),
          String(h.rows.avgScore), `%${h.rows.completionRate}`,
        ]),
        foot: [[
          'GRUP TOPLAMI', String(totalStaff), String(totalTrainings), String(totalAssigned),
          String(totalPassed), String(totalFailed), String(groupAvgScore), `%${groupCompletionRate}`,
        ]],
        footStyles: { font: TURKISH_FONT_FAMILY, fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], textColor: [15, 23, 42] as [number, number, number] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
          4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const val = parseInt(String(data.cell.raw).replace('%', '') || '0')
            if (val >= 80) data.cell.styles.textColor = COLOR_SUCCESS
            else if (val >= 60) data.cell.styles.textColor = COLOR_WARNING
            else data.cell.styles.textColor = COLOR_DANGER
          }
        },
      })

      // ── Hastane-başı detay bölümleri ──
      for (const h of hospitals) {
        doc.addPage()
        let hy = 18
        hy = renderSectionTitle(doc, h.name, hy)
        hy = renderKpiCards(doc, [
          { label: 'Personel', value: String(h.rows.staffCount), color: BRAND_PRIMARY },
          { label: 'Atama', value: String(h.rows.totalAssigned), color: [59, 130, 246] },
          { label: 'Tamamlanma', value: `%${h.rows.completionRate}`, color: rgbForRate(h.rows.completionRate) },
          { label: 'Ort. Puan', value: String(h.rows.avgScore), color: rgbForRate(h.rows.avgScore) },
        ], hy)

        if (h.rows.trainingRows.length === 0) {
          doc.setFont(TURKISH_FONT_FAMILY, 'normal')
          doc.setFontSize(11)
          doc.setTextColor(...COLOR_MUTED)
          doc.text('Bu hastane için aktif eğitim bulunmuyor.', 10, hy + 8)
          continue
        }

        hy = renderSectionTitle(doc, 'Eğitim Bazlı Performans', hy)
        autoTable(doc, {
          ...tableBase,
          startY: hy,
          head: [['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %']],
          body: h.rows.trainingRows.map(t => [
            truncate(t.title, 60), String(t.assigned), String(t.completed),
            String(t.failed), String(t.avgScore), `%${t.rate}`,
          ]),
          columnStyles: {
            0: { cellWidth: 110 },
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              const val = parseInt(String(data.cell.raw).replace('%', '') || '0')
              if (val >= 80) data.cell.styles.textColor = COLOR_SUCCESS
              else if (val >= 60) data.cell.styles.textColor = COLOR_WARNING
              else data.cell.styles.textColor = COLOR_DANGER
            }
          },
        })
      }

      renderChrome(doc, group.name, REPORT_TITLE, dateLabel)
      const pdfBuffer = doc.output('arraybuffer')

      await audit({
        action: 'group.report.export',
        entityType: 'organization_group',
        entityId: groupId,
        newData: { format: 'pdf', hospitalCount: hospitals.length },
      })

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="grup-konsolide-rapor-${dateStr}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    // ── Excel ──
    const wb = new ExcelJS.Workbook()
    wb.creator = group.name
    wb.company = group.name
    wb.title = `${group.name} — ${REPORT_TITLE}`
    wb.created = new Date()

    const metaArgs = { dateLabel: `Rapor Tarihi: ${dateLabel}`, filterLabel: filterLabel ?? undefined }

    // Sheet 1 — Grup Özeti (hastane karşılaştırması + toplam)
    const summary = wb.addWorksheet('Grup Özeti', { views: [{ state: 'frozen', ySplit: 6 }] })
    summary.columns = [
      { key: 'name', width: 32 },
      { key: 'staff', width: 12 },
      { key: 'trainings', width: 14 },
      { key: 'assigned', width: 12 },
      { key: 'passed', width: 12 },
      { key: 'failed', width: 12 },
      { key: 'avgScore', width: 12 },
      { key: 'completion', width: 14 },
    ]
    addWorkbookMetadata(summary, group.name, REPORT_TITLE, metaArgs, 8)
    const sumHdr = summary.addRow(['Hastane', 'Personel', 'Aktif Eğitim', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Tamamlanma'])
    styleHeaderRow(sumHdr)
    for (const h of hospitals) {
      const row = summary.addRow([
        sanitizeCell(h.name), h.rows.staffCount, h.activeTrainingCount, h.rows.totalAssigned,
        h.rows.passedCount, h.rows.failedCount, h.rows.avgScore, h.rows.completionRate / 100,
      ])
      row.getCell(8).numFmt = '0%'
      colorRateCell(row.getCell(8), h.rows.completionRate)
      if (h.rows.failedCount > 0) row.getCell(6).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
    }
    const firstDataRow = sumHdr.number + 1
    applyZebraStripes(summary, firstDataRow, summary.rowCount, 8)
    // Toplam satırı
    const totalRow = summary.addRow([
      'GRUP TOPLAMI', totalStaff, totalTrainings, totalAssigned,
      totalPassed, totalFailed, groupAvgScore, groupCompletionRate / 100,
    ])
    totalRow.getCell(8).numFmt = '0%'
    totalRow.font = { bold: true, name: 'Arial', size: 11 }
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.primaryLight } }
    })
    summary.autoFilter = { from: { row: sumHdr.number, column: 1 }, to: { row: summary.rowCount - 1, column: 8 } }

    // Hastane-başı detay sheet'leri (eğitim bazlı)
    const usedNames = new Set<string>(['Grup Özeti'])
    for (const h of hospitals) {
      const sheetName = sanitizeSheetName(h.name, usedNames)
      const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { key: 'title', width: 50 },
        { key: 'assigned', width: 12 },
        { key: 'completed', width: 14 },
        { key: 'failed', width: 12 },
        { key: 'avgScore', width: 12 },
        { key: 'rate', width: 12 },
      ]
      addWorkbookMetadata(ws, h.name, 'Eğitim Bazlı Performans', metaArgs, 6)
      const hdr = ws.addRow(['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %'])
      styleHeaderRow(hdr)
      if (h.rows.trainingRows.length === 0) {
        const note = ws.addRow(['Bu hastane için aktif eğitim bulunmuyor.'])
        note.font = { italic: true, color: { argb: XL.muted }, name: 'Arial', size: 10 }
        ws.mergeCells(note.number, 1, note.number, 6)
        continue
      }
      for (const t of h.rows.trainingRows) {
        const row = ws.addRow([sanitizeCell(t.title), t.assigned, t.completed, t.failed, t.avgScore, t.rate / 100])
        row.getCell(6).numFmt = '0%'
        colorRateCell(row.getCell(6), t.rate)
        if (t.failed > 0) row.getCell(4).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 6)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 6 } }
    }

    const buffer = await wb.xlsx.writeBuffer()

    await audit({
      action: 'group.report.export',
      entityType: 'organization_group',
      entityId: groupId,
      newData: { format: 'xlsx', hospitalCount: hospitals.length },
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="grup-konsolide-rapor-${dateStr}.xlsx"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error('group-report-export', 'Grup export başarısız', { error: err, groupId })
    return errorResponse('Rapor dışa aktarma sırasında hata oluştu', 500)
  }
})
