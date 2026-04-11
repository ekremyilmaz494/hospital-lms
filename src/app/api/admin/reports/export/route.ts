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
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

// ── Helpers ──

/** jsPDF Helvetica fontu Türkçe karakterleri desteklemediği için ASCII'ye dönüştür */
const TR_MAP: Record<string, string> = {
  'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
  'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
}
function tr(text: string): string {
  return text.replace(/[ğĞüÜşŞıİöÖçÇ]/g, (c) => TR_MAP[c] ?? c)
}

function styleHeader(ws: ExcelJS.Worksheet, color = 'FF0D9668') {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 28
  // Alt border
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF000000' } } }
  })
}

function addSummaryHeader(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  const titleRow = ws.addRow([title])
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF0D9668' } }
  titleRow.height = 24
  ws.mergeCells(titleRow.number, 1, titleRow.number, 4)

  const subtitleRow = ws.addRow([subtitle])
  subtitleRow.font = { size: 10, color: { argb: 'FF666666' } }
  ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, 4)
  ws.addRow([]) // boşluk
}

function sanitizeCell(value: unknown): string | number {
  if (typeof value === 'number') return value
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  return str
}

function addConditionalColor(row: ExcelJS.Row, colKey: string, value: number, thresholds: { good: number; warn: number }) {
  const cell = row.getCell(colKey)
  if (value >= thresholds.good) {
    cell.font = { bold: true, color: { argb: 'FF16A34A' } }
  } else if (value >= thresholds.warn) {
    cell.font = { bold: true, color: { argb: 'FFCA8A04' } }
  } else {
    cell.font = { bold: true, color: { argb: 'FFDC2626' } }
  }
}

// ── Data fetcher (reports API ile aynı mantık) ──

async function fetchReportData(orgId: string, dateFrom?: Date, dateTo?: Date) {
  const assignmentDateFilter = dateFrom || dateTo ? {
    assignedAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  const attemptDateFilter = dateFrom || dateTo ? {
    createdAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
  } : {}

  const [org, staffCount, trainings, staff, departments, avgScoreResult] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
    prisma.training.findMany({
      where: { organizationId: orgId },
      include: {
        assignments: {
          where: { ...assignmentDateFilter },
          include: {
            user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
            examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, preExamScore: true, isPassed: true, status: true } },
          },
        },
        videos: { select: { durationSeconds: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' },
      include: {
        assignments: {
          where: { ...assignmentDateFilter },
          include: {
            training: { select: { title: true } },
            examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1, select: { postExamScore: true, isPassed: true, status: true, attemptNumber: true } },
          },
        },
        departmentRel: { select: { name: true } },
      },
      take: 2000,
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      include: {
        users: {
          where: { role: 'staff', isActive: true },
          include: { assignments: { where: { ...assignmentDateFilter }, select: { status: true } } },
        },
      },
    }),
    prisma.examAttempt.aggregate({
      where: { training: { organizationId: orgId }, postExamScore: { not: null }, ...attemptDateFilter },
      _avg: { postExamScore: true },
    }),
  ])

  return { org, staffCount, trainings, staff, departments, avgScoreResult }
}

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`report-export:${dbUser!.organizationId}`, 5, 60)
  if (!allowed) return errorResponse('Cok fazla disa aktarma istegi. Lutfen bekleyin.', 429)

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'xlsx'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const dateFrom = fromParam ? new Date(fromParam) : undefined
  const dateTo = toParam ? new Date(toParam) : undefined

  try {
    const { org, staffCount, trainings, staff, departments, avgScoreResult } = await fetchReportData(orgId, dateFrom, dateTo)

    const orgName = org?.name ?? 'Devakent Hastanesi'
    const dateStr = new Date().toISOString().slice(0, 10)
    const dateLabel = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

    // ── Hesaplamalar ──
    const allAssignments = trainings.flatMap(t => t.assignments)
    const totalAssigned = allAssignments.length
    const passedCount = allAssignments.filter(a => a.status === 'passed').length
    const failedCount = allAssignments.filter(a => a.status === 'failed').length
    const avgScore = avgScoreResult._avg.postExamScore ? Math.round(Number(avgScoreResult._avg.postExamScore)) : 0
    const completionRate = totalAssigned > 0 ? Math.round((passedCount / totalAssigned) * 100) : 0

    // Training data
    const trainingRows = trainings.map(t => {
      const scores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
      const assigned = t.assignments.length
      const completed = t.assignments.filter(a => a.status === 'passed').length
      const failed = t.assignments.filter(a => a.status === 'failed').length
      const avgTrainingScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0
      return { title: t.title, assigned, completed, failed, avgScore: avgTrainingScore, rate }
    })

    // Staff data
    const staffRows = staff.map(s => {
      const completed = s.assignments.filter(a => a.status === 'passed').length
      const failed = s.assignments.filter(a => a.status === 'failed').length
      const scores = s.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(sc => sc != null).map(Number)
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      const status = avg >= 80 ? 'Yildiz' : avg >= 50 ? 'Normal' : s.assignments.length > 0 ? 'Risk' : 'Yeni'
      return {
        name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        dept: s.departmentRel?.name ?? '',
        totalAssigned: s.assignments.length,
        completed,
        failed,
        avgScore: avg,
        status,
      }
    }).sort((a, b) => b.avgScore - a.avgScore)

    // Department data
    const deptRows = departments.map(d => {
      const totalDeptAssignments = d.users.flatMap(u => u.assignments)
      const passed = totalDeptAssignments.filter(a => a.status === 'passed').length
      const failed = totalDeptAssignments.filter(a => a.status === 'failed').length
      const rate = totalDeptAssignments.length > 0 ? Math.round((passed / totalDeptAssignments.length) * 100) : 0
      return { name: d.name, personel: d.users.length, passed, failed, rate }
    }).sort((a, b) => b.rate - a.rate)

    // Failure data
    const failureRows = staff.flatMap(s =>
      s.assignments
        .filter(a => a.status === 'failed')
        .map(a => ({
          name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          dept: s.departmentRel?.name ?? '',
          training: a.training?.title ?? '',
          attempts: a.examAttempts[0]?.attemptNumber ?? 0,
          lastScore: a.examAttempts[0]?.postExamScore ? Number(a.examAttempts[0].postExamScore) : 0,
        }))
    )

    // Score comparison
    const scoreComparison = trainings.map(t => {
      const preScores = t.assignments.map(a => a.examAttempts[0]?.preExamScore).filter(s => s != null).map(Number)
      const postScores = t.assignments.map(a => a.examAttempts[0]?.postExamScore).filter(s => s != null).map(Number)
      const pre = preScores.length > 0 ? Math.round(preScores.reduce((a, b) => a + b, 0) / preScores.length) : 0
      const post = postScores.length > 0 ? Math.round(postScores.reduce((a, b) => a + b, 0) / postScores.length) : 0
      return { title: t.title, preScore: pre, postScore: post, improvement: post - pre, sampleSize: postScores.length }
    }).filter(d => d.sampleSize > 0)

    // ── PDF Export ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pw = doc.internal.pageSize.getWidth()

      // ── Page 1: Kapak + Ozet ──
      doc.setFontSize(22)
      doc.setTextColor(13, 150, 104)
      doc.text(tr(orgName), pw / 2, 30, { align: 'center' })
      doc.setFontSize(16)
      doc.setTextColor(50)
      doc.text('Egitim Performans Raporu', pw / 2, 42, { align: 'center' })
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`Rapor Tarihi: ${dateLabel}`, pw / 2, 50, { align: 'center' })
      if (dateFrom || dateTo) {
        const filterText = `Filtre: ${dateFrom ? dateFrom.toLocaleDateString('tr-TR') : '...'} - ${dateTo ? dateTo.toLocaleDateString('tr-TR') : '...'}`
        doc.text(filterText, pw / 2, 56, { align: 'center' })
      }

      // Divider
      doc.setDrawColor(13, 150, 104)
      doc.setLineWidth(0.5)
      doc.line(40, 62, pw - 40, 62)

      // Summary boxes
      autoTable(doc, {
        startY: 70,
        head: [['Aktif Personel', 'Toplam Atama', 'Basarili', 'Basarisiz', 'Basari Orani', 'Ort. Puan']],
        body: [[String(staffCount), String(totalAssigned), String(passedCount), String(failedCount), `%${completionRate}`, String(avgScore)]],
        theme: 'grid',
        headStyles: { fillColor: [13, 150, 104], fontSize: 9, halign: 'center' },
        styles: { fontSize: 11, halign: 'center', cellPadding: 4 },
        bodyStyles: { fontStyle: 'bold' },
      })

      // ── Page 2: Egitim Bazli ──
      doc.addPage()
      doc.setFontSize(14)
      doc.setTextColor(30)
      doc.text('Egitim Bazli Rapor', 14, 15)

      autoTable(doc, {
        startY: 22,
        head: [['Egitim', 'Atanan', 'Tamamlayan', 'Basarisiz', 'Ort. Puan', 'Basari %']],
        body: trainingRows.map(t => {
          const title = tr(t.title)
          return [
            title.length > 40 ? title.slice(0, 40) + '...' : title,
            String(t.assigned), String(t.completed), String(t.failed),
            String(t.avgScore), `%${t.rate}`,
          ]
        }),
        theme: 'striped',
        headStyles: { fillColor: [13, 150, 104], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 80 } },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const val = parseInt(data.cell.text[0]?.replace('%', '') ?? '0')
            if (val >= 80) data.cell.styles.textColor = [22, 163, 74]
            else if (val >= 60) data.cell.styles.textColor = [202, 138, 4]
            else data.cell.styles.textColor = [220, 38, 38]
          }
        },
      })

      // ── Page 3: Personel Performansi ──
      doc.addPage()
      doc.setFontSize(14)
      doc.setTextColor(30)
      doc.text('Personel Performans Raporu', 14, 15)

      autoTable(doc, {
        startY: 22,
        head: [['Ad Soyad', 'Departman', 'Atanan', 'Basarili', 'Basarisiz', 'Ort. Puan', 'Durum']],
        body: staffRows.map(s => [
          tr(s.name), tr(s.dept),
          String(s.totalAssigned), String(s.completed), String(s.failed),
          String(s.avgScore), s.status,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [13, 150, 104], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 } },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const text = data.cell.text[0]
            if (text === 'Yildiz') { data.cell.styles.textColor = [22, 163, 74]; data.cell.styles.fontStyle = 'bold' }
            else if (text === 'Risk') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold' }
          }
        },
      })

      // ── Page 4: Departman ──
      doc.addPage()
      doc.setFontSize(14)
      doc.setTextColor(30)
      doc.text('Departman Analizi', 14, 15)

      autoTable(doc, {
        startY: 22,
        head: [['Departman', 'Personel', 'Basarili', 'Basarisiz', 'Basari Orani']],
        body: deptRows.map(d => [tr(d.name), String(d.personel), String(d.passed), String(d.failed), `%${d.rate}`]),
        theme: 'striped',
        headStyles: { fillColor: [13, 150, 104], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const val = parseInt(data.cell.text[0]?.replace('%', '') ?? '0')
            if (val >= 80) data.cell.styles.textColor = [22, 163, 74]
            else if (val >= 60) data.cell.styles.textColor = [202, 138, 4]
            else data.cell.styles.textColor = [220, 38, 38]
          }
        },
      })

      // Failure section on same page if fits
      if (failureRows.length > 0) {
        doc.addPage()
        doc.setFontSize(14)
        doc.setTextColor(220, 38, 38)
        doc.text(`Basarisiz Personel (${failureRows.length})`, 14, 15)

        autoTable(doc, {
          startY: 22,
          head: [['Ad Soyad', 'Departman', 'Egitim', 'Deneme', 'Son Puan']],
          body: failureRows.map(f => {
            const training = tr(f.training)
            return [tr(f.name), tr(f.dept), training.length > 35 ? training.slice(0, 35) + '...' : training, String(f.attempts), String(f.lastScore)]
          }),
          theme: 'striped',
          headStyles: { fillColor: [220, 38, 38], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          alternateRowStyles: { fillColor: [254, 242, 242] },
        })
      }

      // Score comparison
      if (scoreComparison.length > 0) {
        doc.addPage()
        doc.setFontSize(14)
        doc.setTextColor(30)
        doc.text('On Sinav / Son Sinav Karsilastirma', 14, 15)

        autoTable(doc, {
          startY: 22,
          head: [['Egitim', 'On Sinav', 'Son Sinav', 'Gelisim', 'Orneklem']],
          body: scoreComparison.map(s => {
            const title = tr(s.title)
            return [
            title.length > 40 ? title.slice(0, 40) + '...' : title,
            `%${s.preScore}`, `%${s.postScore}`,
            `${s.improvement >= 0 ? '+' : ''}${s.improvement}%`,
            String(s.sampleSize),
          ]}),
          theme: 'striped',
          headStyles: { fillColor: [13, 150, 104], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 80 } },
          alternateRowStyles: { fillColor: [245, 248, 250] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = parseInt(data.cell.text[0] ?? '0')
              if (val >= 0) data.cell.styles.textColor = [22, 163, 74]
              else data.cell.styles.textColor = [220, 38, 38]
            }
          },
        })
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150)
        const ph = doc.internal.pageSize.getHeight()
        doc.text(`${tr(orgName)} — Egitim Performans Raporu`, 14, ph - 8)
        doc.text(`Sayfa ${i}/${totalPages}`, pw - 14, ph - 8, { align: 'right' })
        doc.text(dateLabel, pw / 2, ph - 8, { align: 'center' })
      }

      const pdfBuffer = doc.output('arraybuffer')

      await createAuditLog({
        userId: dbUser!.id,
        organizationId: orgId,
        action: 'report.export',
        entityType: 'export',
        entityId: orgId,
        newData: { format: 'pdf' },
        request,
      })

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rapor-${dateStr}.pdf"`,
        },
      })
    }

    // ── Excel Export ──
    const wb = new ExcelJS.Workbook()
    wb.creator = orgName
    wb.created = new Date()

    // Sheet 1: Ozet
    const wsOzet = wb.addWorksheet('Genel Ozet')
    addSummaryHeader(wsOzet, orgName, `Egitim Performans Raporu — ${dateLabel}`)

    wsOzet.columns = [
      { key: 'metric', width: 30 },
      { key: 'value', width: 20 },
    ]
    const metricsHeader = wsOzet.addRow({ metric: 'Metrik', value: 'Deger' })
    metricsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
    metricsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
    metricsHeader.height = 24

    const metrics: [string, string | number][] = [
      ['Aktif Personel', staffCount],
      ['Toplam Egitim', trainings.length],
      ['Toplam Atama', totalAssigned],
      ['Basarili', passedCount],
      ['Basarisiz', failedCount],
      ['Basari Orani', `%${completionRate}`],
      ['Ortalama Puan', avgScore],
    ]
    for (const [metric, value] of metrics) {
      wsOzet.addRow({ metric, value })
    }

    // Sheet 2: Egitim Bazli
    const wsTraining = wb.addWorksheet('Egitim Bazli')
    wsTraining.columns = [
      { header: 'Egitim', key: 'title', width: 40 },
      { header: 'Atanan', key: 'assigned', width: 12 },
      { header: 'Tamamlayan', key: 'completed', width: 14 },
      { header: 'Basarisiz', key: 'failed', width: 12 },
      { header: 'Ort. Puan', key: 'avgScore', width: 12 },
      { header: 'Basari %', key: 'rate', width: 12 },
    ]
    styleHeader(wsTraining)
    for (const t of trainingRows) {
      const row = wsTraining.addRow({
        title: sanitizeCell(t.title),
        assigned: t.assigned,
        completed: t.completed,
        failed: t.failed,
        avgScore: t.avgScore,
        rate: t.rate,
      })
      addConditionalColor(row, 'rate', t.rate, { good: 80, warn: 60 })
      if (t.failed > 0) {
        row.getCell('failed').font = { color: { argb: 'FFDC2626' }, bold: true }
      }
    }

    // Sheet 3: Personel
    const wsStaff = wb.addWorksheet('Personel')
    wsStaff.columns = [
      { header: 'Ad Soyad', key: 'name', width: 25 },
      { header: 'Departman', key: 'dept', width: 20 },
      { header: 'Atanan', key: 'totalAssigned', width: 12 },
      { header: 'Basarili', key: 'completed', width: 12 },
      { header: 'Basarisiz', key: 'failed', width: 12 },
      { header: 'Ort. Puan', key: 'avgScore', width: 12 },
      { header: 'Durum', key: 'status', width: 14 },
    ]
    styleHeader(wsStaff)

    const statusColors: Record<string, string> = {
      Yildiz: 'FFD4EDDA',
      Normal: 'FFF0F9FF',
      Risk: 'FFF8D7DA',
      Yeni: 'FFE2E8F0',
    }
    for (const s of staffRows) {
      const row = wsStaff.addRow({
        name: sanitizeCell(s.name),
        dept: sanitizeCell(s.dept),
        totalAssigned: s.totalAssigned,
        completed: s.completed,
        failed: s.failed,
        avgScore: s.avgScore,
        status: s.status,
      })
      addConditionalColor(row, 'avgScore', s.avgScore, { good: 80, warn: 50 })
      const bg = statusColors[s.status]
      if (bg) {
        row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      }
    }

    // Sheet 4: Departman
    const wsDept = wb.addWorksheet('Departman')
    wsDept.columns = [
      { header: 'Departman', key: 'name', width: 25 },
      { header: 'Personel', key: 'personel', width: 12 },
      { header: 'Basarili', key: 'passed', width: 12 },
      { header: 'Basarisiz', key: 'failed', width: 12 },
      { header: 'Basari %', key: 'rate', width: 12 },
    ]
    styleHeader(wsDept)
    for (const d of deptRows) {
      const row = wsDept.addRow({
        name: sanitizeCell(d.name),
        personel: d.personel,
        passed: d.passed,
        failed: d.failed,
        rate: d.rate,
      })
      addConditionalColor(row, 'rate', d.rate, { good: 80, warn: 60 })
    }

    // Sheet 5: Basarisiz Personel
    if (failureRows.length > 0) {
      const wsFail = wb.addWorksheet('Basarisiz')
      wsFail.columns = [
        { header: 'Ad Soyad', key: 'name', width: 25 },
        { header: 'Departman', key: 'dept', width: 20 },
        { header: 'Egitim', key: 'training', width: 35 },
        { header: 'Deneme', key: 'attempts', width: 10 },
        { header: 'Son Puan', key: 'lastScore', width: 12 },
      ]
      styleHeader(wsFail, 'FFDC2626')
      for (const f of failureRows) {
        wsFail.addRow({
          name: sanitizeCell(f.name),
          dept: sanitizeCell(f.dept),
          training: sanitizeCell(f.training),
          attempts: f.attempts,
          lastScore: f.lastScore,
        })
      }
    }

    // Sheet 6: Skor Karsilastirma
    if (scoreComparison.length > 0) {
      const wsScore = wb.addWorksheet('Skor Analizi')
      wsScore.columns = [
        { header: 'Egitim', key: 'title', width: 40 },
        { header: 'On Sinav', key: 'preScore', width: 12 },
        { header: 'Son Sinav', key: 'postScore', width: 12 },
        { header: 'Gelisim', key: 'improvement', width: 12 },
        { header: 'Orneklem', key: 'sampleSize', width: 12 },
      ]
      styleHeader(wsScore)
      for (const s of scoreComparison) {
        const row = wsScore.addRow({
          title: sanitizeCell(s.title),
          preScore: s.preScore,
          postScore: s.postScore,
          improvement: s.improvement,
          sampleSize: s.sampleSize,
        })
        const impCell = row.getCell('improvement')
        if (s.improvement >= 0) {
          impCell.font = { bold: true, color: { argb: 'FF16A34A' } }
        } else {
          impCell.font = { bold: true, color: { argb: 'FFDC2626' } }
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer()

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'report.export',
      entityType: 'export',
      entityId: orgId,
      newData: { format: 'xlsx' },
      request,
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rapor-${dateStr}.xlsx"`,
      },
    })
  } catch (err) {
    logger.error('report-export', 'Export failed', { error: err })
    return errorResponse('Rapor disa aktarma sirasinda hata olustu', 500)
  }
}
