import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { applyTurkishFont, TURKISH_FONT_FAMILY } from '@/lib/pdf/helpers/font'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { resolveReportFilters } from '../_shared'
import { fetchReportData, buildReportRows, truncate } from '../_report-data'
import {
  BRAND_PRIMARY, BRAND_ACCENT, COLOR_SUCCESS, COLOR_WARNING, COLOR_DANGER,
  COLOR_MUTED, COLOR_BORDER, COLOR_SURFACE_ALT, XL,
  sanitizeCell, addWorkbookMetadata, styleHeaderRow, applyZebraStripes, colorRateCell,
  renderCoverPage, renderChrome, renderKpiCards, renderSectionTitle,
} from '../_report-format'

type ReportSection =
  | 'overview'
  | 'training'
  | 'staff'
  | 'department'
  | 'failure'
  | 'score-comparison'
  | 'duration'

const SECTION_TITLES: Record<ReportSection, string> = {
  'overview': 'Genel Özet Raporu',
  'training': 'Eğitim Bazlı Performans Raporu',
  'staff': 'Personel Performans Raporu',
  'department': 'Departman Analiz Raporu',
  'failure': 'Başarısızlık Analiz Raporu',
  'score-comparison': 'Ön / Son Sınav Karşılaştırma Raporu',
  'duration': 'Süre Analiz Raporu',
}

// ── Rapor handler ──

export const GET = withAdminRoute(async ({ request, organizationId: orgId, audit }) => {
  const allowed = await checkRateLimit(`report-export:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') ?? 'xlsx') as 'pdf' | 'xlsx'
  const section = (searchParams.get('section') ?? 'overview') as ReportSection

  if (!SECTION_TITLES[section]) {
    return errorResponse('Geçersiz rapor bölümü', 400)
  }

  // Ekrandaki filtrelerin AYNISI (tarih + departman + dönem) — export ekranla birebir tutsun.
  const resolved = await resolveReportFilters(request, orgId)
  if (resolved.error) return resolved.error
  const filters = resolved.filters
  const dateFrom = filters.dateFrom
  const dateTo = filters.dateTo

  try {
    const { org, staffCount, trainings, staff, departments, avgScoreResult, truncated, selectedDeptName } =
      await fetchReportData(filters)

    const orgName = org?.name ?? 'Organizasyon'
    const sectionTitle = SECTION_TITLES[section]
    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // ── Filtre & uyarı etiketleri ──
    // Filtre etiketi: tarih + departman + dönem — kullanıcı neyi indirdiğini görsün,
    // ekrandaki filtrelerle aynı kapsam olduğunu doğrulayabilsin.
    const filterParts: string[] = []
    if (dateFrom || dateTo) {
      const f = dateFrom ? dateFrom.toLocaleDateString('tr-TR') : '…'
      const t = dateTo ? dateTo.toLocaleDateString('tr-TR') : '…'
      filterParts.push(`${f} – ${t}`)
    }
    if (selectedDeptName) filterParts.push(`Departman: ${selectedDeptName}`)
    if (filters.targetPeriod) filterParts.push(`Dönem: ${filters.targetPeriod.label}`)
    const filterLabel: string | null = filterParts.length > 0 ? `Filtre: ${filterParts.join(' · ')}` : null
    let truncationLabel: string | null = null
    if (truncated.trainings || truncated.staff) {
      const parts: string[] = []
      if (truncated.trainings) parts.push(`${truncated.trainings.total} eğitimden ${truncated.trainings.shown} tanesi`)
      if (truncated.staff) parts.push(`${truncated.staff.total} personelden ${truncated.staff.shown} tanesi`)
      truncationLabel = `${parts.join(', ')} raporda yer alıyor. Filtre uygulayın.`
    }

    // ── Özet + tablo satırları — paylaşılan builder (grup export'uyla birebir tutar) ──
    const {
      totalAssigned, passedCount, failedCount, avgScore, completionRate,
      trainingRows, staffRows, deptRows, failureRows, scoreComparison, durationRows,
    } = buildReportRows({ org, staffCount, trainings, staff, departments, avgScoreResult, truncated, selectedDeptName })

    // ── PDF ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      await applyTurkishFont(doc)

      const coverLogo = await resolveOrgLogoDataUrl(org?.logoUrl)
      renderCoverPage(doc, orgName, sectionTitle, dateLabel, filterLabel, truncationLabel, coverLogo)

      // İçerik sayfaları
      doc.addPage()
      let y = 18

      const tableBase = {
        theme: 'grid' as const,
        styles: { font: TURKISH_FONT_FAMILY, fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] as [number, number, number], lineColor: COLOR_BORDER, lineWidth: 0.1 },
        headStyles: { font: TURKISH_FONT_FAMILY, fontStyle: 'bold' as const, fillColor: BRAND_PRIMARY, textColor: [255, 255, 255] as [number, number, number], fontSize: 9, halign: 'left' as const, cellPadding: 3 },
        alternateRowStyles: { fillColor: COLOR_SURFACE_ALT },
        margin: { top: 14, bottom: 14, left: 10, right: 10 },
      }

      if (section === 'overview') {
        y = renderSectionTitle(doc, 'Performans Göstergeleri', y)
        y = renderKpiCards(doc, [
          { label: 'Aktif Personel', value: String(staffCount), color: BRAND_PRIMARY },
          { label: 'Toplam Atama', value: String(totalAssigned), color: [59, 130, 246] },
          { label: 'Başarılı', value: String(passedCount), color: COLOR_SUCCESS },
          { label: 'Başarısız', value: String(failedCount), color: COLOR_DANGER },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: BRAND_ACCENT },
          { label: 'Ort. Puan', value: String(avgScore), color: [139, 92, 246] },
        ], y)

        // En iyi 5 personel
        const top5 = staffRows.slice(0, 5)
        if (top5.length > 0) {
          y = renderSectionTitle(doc, 'En İyi 5 Personel', y + 2)
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['#', 'Ad Soyad', 'Departman', 'Tamamlanan', 'Ort. Puan']],
            body: top5.map((s, i) => [String(i + 1), s.name, s.dept, String(s.completed), `${s.avgScore}`]),
            columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          y = (doc as any).lastAutoTable.finalY + 6
        }

        // Risk altındakiler
        const risky = staffRows.filter(s => s.status === 'Risk').slice(0, 5)
        if (risky.length > 0) {
          y = renderSectionTitle(doc, 'Risk Altındaki Personel', y)
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['#', 'Ad Soyad', 'Departman', 'Başarısız', 'Ort. Puan']],
            body: risky.map((s, i) => [String(i + 1), s.name, s.dept, String(s.failed), `${s.avgScore}`]),
            headStyles: { ...tableBase.headStyles, fillColor: COLOR_DANGER },
            columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
          })
        }
      }

      if (section === 'training') {
        y = renderKpiCards(doc, [
          { label: 'Toplam Eğitim', value: String(trainings.length), color: BRAND_PRIMARY },
          { label: 'Toplam Atama', value: String(totalAssigned), color: [59, 130, 246] },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: COLOR_SUCCESS },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Eğitim Bazlı Performans', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %']],
          body: trainingRows.map(t => [
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

      if (section === 'staff') {
        const stars = staffRows.filter(s => s.status === 'Yıldız').length
        const risks = staffRows.filter(s => s.status === 'Risk').length
        y = renderKpiCards(doc, [
          { label: 'Toplam Personel', value: String(staffRows.length), color: BRAND_PRIMARY },
          { label: 'Yıldız', value: String(stars), color: COLOR_SUCCESS },
          { label: 'Risk Altında', value: String(risks), color: COLOR_DANGER },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Personel Performans Detayı', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Ad Soyad', 'Departman', 'Atanan', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Durum']],
          body: staffRows.map(s => [
            s.name, s.dept, String(s.totalAssigned),
            String(s.completed), String(s.failed),
            String(s.avgScore), s.status,
          ]),
          columnStyles: {
            0: { cellWidth: 55 }, 1: { cellWidth: 40 },
            2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const text = String(data.cell.raw)
              if (text === 'Yıldız') { data.cell.styles.textColor = COLOR_SUCCESS; data.cell.styles.fontStyle = 'bold' }
              else if (text === 'Risk') { data.cell.styles.textColor = COLOR_DANGER; data.cell.styles.fontStyle = 'bold' }
              else if (text === 'Normal') { data.cell.styles.textColor = COLOR_MUTED }
            }
          },
        })
      }

      if (section === 'department') {
        y = renderKpiCards(doc, [
          { label: 'Departman', value: String(deptRows.length), color: BRAND_PRIMARY },
          { label: 'Toplam Personel', value: String(deptRows.reduce((s, d) => s + d.personel, 0)), color: [59, 130, 246] },
          { label: 'Başarı Oranı', value: `%${completionRate}`, color: COLOR_SUCCESS },
          { label: 'Ort. Puan', value: String(avgScore), color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Departman Bazlı Analiz', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Departman', 'Personel', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Başarı %']],
          body: deptRows.map(d => [
            d.name, String(d.personel), String(d.totalAssigned),
            String(d.passed), String(d.failed),
            String(d.avgScore), `%${d.rate}`,
          ]),
          columnStyles: {
            0: { cellWidth: 70 },
            1: { halign: 'right' }, 2: { halign: 'right' },
            3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const val = parseInt(String(data.cell.raw).replace('%', '') || '0')
              if (val >= 80) data.cell.styles.textColor = COLOR_SUCCESS
              else if (val >= 60) data.cell.styles.textColor = COLOR_WARNING
              else data.cell.styles.textColor = COLOR_DANGER
            }
          },
        })
      }

      if (section === 'failure') {
        const uniqueFailedStaff = new Set(failureRows.map(f => f.name)).size
        const uniqueFailedTrainings = new Set(failureRows.map(f => f.training)).size
        y = renderKpiCards(doc, [
          { label: 'Toplam Başarısızlık', value: String(failureRows.length), color: COLOR_DANGER },
          { label: 'Etkilenen Personel', value: String(uniqueFailedStaff), color: COLOR_DANGER },
          { label: 'Etkilenen Eğitim', value: String(uniqueFailedTrainings), color: COLOR_WARNING },
          { label: 'Ort. Son Puan', value: failureRows.length > 0 ? String(Math.round(failureRows.reduce((s, f) => s + f.lastScore, 0) / failureRows.length)) : '0', color: BRAND_ACCENT },
        ], y)

        y = renderSectionTitle(doc, 'Başarısızlık Detayları', y)
        if (failureRows.length === 0) {
          doc.setFont(TURKISH_FONT_FAMILY, 'normal')
          doc.setFontSize(11)
          doc.setTextColor(...COLOR_MUTED)
          doc.text('Bu dönem için başarısızlık kaydı yok.', 10, y + 8)
        } else {
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['Ad Soyad', 'Departman', 'Eğitim', 'Deneme', 'Son Puan']],
            body: failureRows.map(f => [
              f.name, f.dept, truncate(f.training, 50),
              String(f.attempts), String(f.lastScore),
            ]),
            headStyles: { ...tableBase.headStyles, fillColor: COLOR_DANGER },
            columnStyles: {
              0: { cellWidth: 50 }, 1: { cellWidth: 40 }, 2: { cellWidth: 90 },
              3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' },
            },
          })
        }
      }

      if (section === 'score-comparison') {
        const avgPre = scoreComparison.length > 0 ? Math.round(scoreComparison.reduce((s, x) => s + x.preScore, 0) / scoreComparison.length) : 0
        const avgPost = scoreComparison.length > 0 ? Math.round(scoreComparison.reduce((s, x) => s + x.postScore, 0) / scoreComparison.length) : 0
        y = renderKpiCards(doc, [
          { label: 'Ort. Ön Sınav', value: `%${avgPre}`, color: COLOR_WARNING },
          { label: 'Ort. Son Sınav', value: `%${avgPost}`, color: COLOR_SUCCESS },
          { label: 'Gelişim', value: `${avgPost - avgPre >= 0 ? '+' : ''}${avgPost - avgPre} pts`, color: BRAND_PRIMARY },
          { label: 'Ölçülen Eğitim', value: String(scoreComparison.length), color: [59, 130, 246] },
        ], y)

        y = renderSectionTitle(doc, 'Ön / Son Sınav Karşılaştırma', y)
        if (scoreComparison.length === 0) {
          doc.setFont(TURKISH_FONT_FAMILY, 'normal')
          doc.setFontSize(11)
          doc.setTextColor(...COLOR_MUTED)
          doc.text('Yeterli veri yok — ön/son sınav tamamlanmış eğitim bulunamadı.', 10, y + 8)
        } else {
          autoTable(doc, {
            ...tableBase,
            startY: y,
            head: [['Eğitim', 'Ön Sınav', 'Son Sınav', 'Gelişim', 'Örneklem']],
            body: scoreComparison.map(s => [
              truncate(s.title, 70),
              `%${s.preScore}`, `%${s.postScore}`,
              `${s.improvement >= 0 ? '+' : ''}${s.improvement}`,
              String(s.sampleSize),
            ]),
            columnStyles: {
              0: { cellWidth: 130 },
              1: { halign: 'right' }, 2: { halign: 'right' },
              3: { halign: 'right', fontStyle: 'bold' }, 4: { halign: 'right' },
            },
            didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 3) {
                const raw = String(data.cell.raw)
                const val = parseInt(raw.replace('+', '') || '0')
                if (val > 0) data.cell.styles.textColor = COLOR_SUCCESS
                else if (val < 0) data.cell.styles.textColor = COLOR_DANGER
              }
            },
          })
        }
      }

      if (section === 'duration') {
        const totalVideoMin = durationRows.reduce((s, d) => s + d.videoMin, 0)
        const totalExamMin = durationRows.reduce((s, d) => s + d.examMin, 0)
        y = renderKpiCards(doc, [
          { label: 'Toplam Eğitim', value: String(durationRows.length), color: BRAND_PRIMARY },
          { label: 'Toplam Video', value: `${totalVideoMin} dk`, color: [59, 130, 246] },
          { label: 'Toplam Sınav', value: `${totalExamMin} dk`, color: BRAND_ACCENT },
          { label: 'Genel Toplam', value: `${totalVideoMin + totalExamMin} dk`, color: COLOR_SUCCESS },
        ], y)

        y = renderSectionTitle(doc, 'Süre Analiz Detayı', y)
        autoTable(doc, {
          ...tableBase,
          startY: y,
          head: [['Eğitim', 'Video (dk)', 'Sınav (dk)', 'Toplam (dk)']],
          body: durationRows.map(d => [
            truncate(d.title, 80), String(d.videoMin), String(d.examMin), String(d.totalMin),
          ]),
          columnStyles: {
            0: { cellWidth: 160 },
            1: { halign: 'right' }, 2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' },
          },
        })
      }

      renderChrome(doc, orgName, sectionTitle, dateLabel)

      const pdfBuffer = doc.output('arraybuffer')

      await audit({
        action: 'report.export',
        entityType: 'export',
        entityId: orgId,
        newData: { format: 'pdf', section },
      })

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rapor-${section}-${dateStr}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    // ── Excel ──
    const wb = new ExcelJS.Workbook()
    wb.creator = orgName
    wb.company = orgName
    wb.title = sectionTitle
    wb.created = new Date()

    const metaArgs = { dateLabel: `Rapor Tarihi: ${dateLabel}`, filterLabel: filterLabel ?? undefined, truncationLabel: truncationLabel ?? undefined }

    if (section === 'overview') {
      const ws = wb.addWorksheet('Genel Özet', {
        views: [{ state: 'frozen', ySplit: 6 }],
        properties: { defaultRowHeight: 20 },
      })
      ws.columns = [
        { key: 'metric', width: 34 },
        { key: 'value', width: 20 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 2)

      const headerRow = ws.addRow(['Metrik', 'Değer'])
      styleHeaderRow(headerRow)

      const metrics: Array<{ label: string; value: string | number; color?: string }> = [
        { label: 'Aktif Personel', value: staffCount },
        { label: 'Toplam Eğitim', value: trainings.length },
        { label: 'Toplam Atama', value: totalAssigned },
        { label: 'Başarılı', value: passedCount, color: XL.success },
        { label: 'Başarısız', value: failedCount, color: XL.danger },
        { label: 'Başarı Oranı', value: completionRate / 100, color: completionRate >= 80 ? XL.success : completionRate >= 60 ? XL.warning : XL.danger },
        { label: 'Ortalama Puan', value: avgScore },
      ]
      for (const m of metrics) {
        const r = ws.addRow([m.label, m.value])
        r.getCell(1).font = { bold: true, name: 'Arial', size: 10 }
        if (m.label === 'Başarı Oranı') {
          r.getCell(2).numFmt = '0%'
        }
        if (m.color) {
          r.getCell(2).font = { bold: true, color: { argb: m.color }, name: 'Arial', size: 11 }
        } else {
          r.getCell(2).font = { bold: true, name: 'Arial', size: 11 }
        }
        r.getCell(2).alignment = { horizontal: 'right' }
      }
      applyZebraStripes(ws, headerRow.number + 1, ws.rowCount, 2)

      // Top 5 performers sheet
      if (staffRows.length > 0) {
        const wsTop = wb.addWorksheet('En İyi 5', { views: [{ state: 'frozen', ySplit: 6 }] })
        wsTop.columns = [
          { header: 'Sıra', key: 'rank', width: 8 },
          { header: 'Ad Soyad', key: 'name', width: 28 },
          { header: 'Departman', key: 'dept', width: 22 },
          { header: 'Tamamlanan', key: 'completed', width: 14 },
          { header: 'Ort. Puan', key: 'avgScore', width: 14 },
        ]
        addWorkbookMetadata(wsTop, orgName, 'En İyi 5 Personel', metaArgs, 5)
        const headerTop = wsTop.addRow(['Sıra', 'Ad Soyad', 'Departman', 'Tamamlanan', 'Ort. Puan'])
        styleHeaderRow(headerTop)
        staffRows.slice(0, 5).forEach((s, i) => {
          const r = wsTop.addRow([i + 1, sanitizeCell(s.name), sanitizeCell(s.dept), s.completed, s.avgScore])
          colorRateCell(r.getCell(5), s.avgScore)
        })
        applyZebraStripes(wsTop, headerTop.number + 1, wsTop.rowCount, 5)
        wsTop.autoFilter = { from: { row: headerTop.number, column: 1 }, to: { row: wsTop.rowCount, column: 5 } }
      }
    }

    if (section === 'training') {
      const ws = wb.addWorksheet('Eğitim Bazlı', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 50 },
        { header: 'Atanan', key: 'assigned', width: 12 },
        { header: 'Tamamlayan', key: 'completed', width: 14 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Başarı %', key: 'rate', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 6)
      const hdr = ws.addRow(['Eğitim', 'Atanan', 'Tamamlayan', 'Başarısız', 'Ort. Puan', 'Başarı %'])
      styleHeaderRow(hdr)

      for (const t of trainingRows) {
        const row = ws.addRow([sanitizeCell(t.title), t.assigned, t.completed, t.failed, t.avgScore, t.rate / 100])
        row.getCell(6).numFmt = '0%'
        colorRateCell(row.getCell(6), t.rate)
        if (t.failed > 0) row.getCell(4).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 6)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 6 } }
    }

    if (section === 'staff') {
      const ws = wb.addWorksheet('Personel', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Ad Soyad', key: 'name', width: 28 },
        { header: 'Departman', key: 'dept', width: 22 },
        { header: 'Atanan', key: 'totalAssigned', width: 12 },
        { header: 'Başarılı', key: 'completed', width: 12 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Durum', key: 'status', width: 14 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 7)
      const hdr = ws.addRow(['Ad Soyad', 'Departman', 'Atanan', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Durum'])
      styleHeaderRow(hdr)

      const statusBg: Record<string, string> = {
        'Yıldız': XL.successBg, 'Normal': XL.primaryLight, 'Risk': XL.dangerBg, 'Yeni': 'FFE2E8F0',
      }
      const statusColor: Record<string, string> = {
        'Yıldız': XL.success, 'Normal': XL.muted, 'Risk': XL.danger, 'Yeni': XL.muted,
      }
      for (const s of staffRows) {
        const row = ws.addRow([
          sanitizeCell(s.name), sanitizeCell(s.dept),
          s.totalAssigned, s.completed, s.failed, s.avgScore, s.status,
        ])
        colorRateCell(row.getCell(6), s.avgScore)
        const statusCell = row.getCell(7)
        statusCell.font = { bold: true, color: { argb: statusColor[s.status] ?? XL.muted }, name: 'Arial', size: 10 }
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg[s.status] ?? 'FFF8FAFC' } }
        statusCell.alignment = { horizontal: 'center' }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 7)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 7 } }
    }

    if (section === 'department') {
      const ws = wb.addWorksheet('Departman', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Departman', key: 'name', width: 28 },
        { header: 'Personel', key: 'personel', width: 12 },
        { header: 'Atama', key: 'totalAssigned', width: 12 },
        { header: 'Başarılı', key: 'passed', width: 12 },
        { header: 'Başarısız', key: 'failed', width: 12 },
        { header: 'Ort. Puan', key: 'avgScore', width: 12 },
        { header: 'Başarı %', key: 'rate', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 7)
      const hdr = ws.addRow(['Departman', 'Personel', 'Atama', 'Başarılı', 'Başarısız', 'Ort. Puan', 'Başarı %'])
      styleHeaderRow(hdr)

      for (const d of deptRows) {
        const row = ws.addRow([
          sanitizeCell(d.name), d.personel, d.totalAssigned, d.passed, d.failed,
          d.avgScore, d.rate / 100,
        ])
        row.getCell(7).numFmt = '0%'
        colorRateCell(row.getCell(7), d.rate)
        if (d.failed > 0) row.getCell(5).font = { color: { argb: XL.danger }, bold: true, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 7)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 7 } }
    }

    if (section === 'failure') {
      const ws = wb.addWorksheet('Başarısızlık', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Ad Soyad', key: 'name', width: 26 },
        { header: 'Departman', key: 'dept', width: 22 },
        { header: 'Eğitim', key: 'training', width: 45 },
        { header: 'Deneme', key: 'attempts', width: 10 },
        { header: 'Son Puan', key: 'lastScore', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 5)
      const hdr = ws.addRow(['Ad Soyad', 'Departman', 'Eğitim', 'Deneme', 'Son Puan'])
      styleHeaderRow(hdr, XL.danger)

      for (const f of failureRows) {
        const row = ws.addRow([
          sanitizeCell(f.name), sanitizeCell(f.dept), sanitizeCell(f.training),
          f.attempts, f.lastScore,
        ])
        row.getCell(5).font = { bold: true, color: { argb: XL.danger }, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 5)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 5 } }
    }

    if (section === 'score-comparison') {
      const ws = wb.addWorksheet('Skor Analizi', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 50 },
        { header: 'Ön Sınav', key: 'preScore', width: 12 },
        { header: 'Son Sınav', key: 'postScore', width: 12 },
        { header: 'Gelişim', key: 'improvement', width: 12 },
        { header: 'Örneklem', key: 'sampleSize', width: 12 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 5)
      const hdr = ws.addRow(['Eğitim', 'Ön Sınav', 'Son Sınav', 'Gelişim', 'Örneklem'])
      styleHeaderRow(hdr)

      for (const s of scoreComparison) {
        const row = ws.addRow([
          sanitizeCell(s.title),
          s.preScore / 100, s.postScore / 100,
          s.improvement,
          s.sampleSize,
        ])
        row.getCell(2).numFmt = '0%'
        row.getCell(3).numFmt = '0%'
        const impCell = row.getCell(4)
        impCell.numFmt = '+0;-0;0'
        if (s.improvement > 0) impCell.font = { bold: true, color: { argb: XL.success }, name: 'Arial', size: 10 }
        else if (s.improvement < 0) impCell.font = { bold: true, color: { argb: XL.danger }, name: 'Arial', size: 10 }
      }
      applyZebraStripes(ws, hdr.number + 1, ws.rowCount, 5)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: ws.rowCount, column: 5 } }
    }

    if (section === 'duration') {
      const ws = wb.addWorksheet('Süre Analizi', { views: [{ state: 'frozen', ySplit: 6 }] })
      ws.columns = [
        { header: 'Eğitim', key: 'title', width: 55 },
        { header: 'Video (dk)', key: 'videoMin', width: 14 },
        { header: 'Sınav (dk)', key: 'examMin', width: 14 },
        { header: 'Toplam (dk)', key: 'totalMin', width: 14 },
      ]
      addWorkbookMetadata(ws, orgName, sectionTitle, metaArgs, 4)
      const hdr = ws.addRow(['Eğitim', 'Video (dk)', 'Sınav (dk)', 'Toplam (dk)'])
      styleHeaderRow(hdr)

      for (const d of durationRows) {
        const row = ws.addRow([sanitizeCell(d.title), d.videoMin, d.examMin, d.totalMin])
        row.getCell(4).font = { bold: true, name: 'Arial', size: 10 }
      }

      // Toplam satırı
      if (durationRows.length > 0) {
        const totalVideo = durationRows.reduce((s, d) => s + d.videoMin, 0)
        const totalExam = durationRows.reduce((s, d) => s + d.examMin, 0)
        const totalRow = ws.addRow(['TOPLAM', totalVideo, totalExam, totalVideo + totalExam])
        totalRow.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FFFFFFFF' } }
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.primary } }
      }
      applyZebraStripes(ws, hdr.number + 1, durationRows.length > 0 ? ws.rowCount - 1 : ws.rowCount, 4)
      ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number + durationRows.length, column: 4 } }
    }

    const buffer = await wb.xlsx.writeBuffer()

    await audit({
      action: 'report.export',
      entityType: 'export',
      entityId: orgId,
      newData: { format: 'xlsx', section },
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rapor-${section}-${dateStr}.xlsx"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error('report-export', 'Export failed', { error: err, section })
    return errorResponse('Rapor dışa aktarma sırasında hata oluştu', 500)
  }
}, { requireOrganization: true })
