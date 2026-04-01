import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { prisma } from '@/lib/prisma'
import {
  getAuthUser,
  requireRole,
  errorResponse,
  createAuditLog,
} from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'

function styleHeader(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D9668' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 24
}

/** Prevent formula injection */
function sanitizeCell(value: unknown): string | number {
  if (typeof value === 'number') return value
  const str = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`
  return str
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(
    `exam-export:${dbUser!.organizationId}`,
    10,
    60,
  )
  if (!allowed)
    return errorResponse('Çok fazla dışa aktarma isteği. Lütfen bekleyin.', 429)

  const orgId = dbUser!.organizationId!

  // Paralel sorgular
  const [exam, attempts, questions, assignments] = await Promise.all([
    prisma.training.findFirst({
      where: { id, organizationId: orgId, examOnly: true },
      include: { _count: { select: { questions: true, assignments: true } } },
    }),
    prisma.examAttempt.findMany({
      where: { trainingId: id, status: 'completed' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            departmentRel: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.question.findMany({
      where: { trainingId: id },
      include: {
        examAnswers: {
          where: { examPhase: 'post' },
          select: { isCorrect: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.trainingAssignment.findMany({
      where: { trainingId: id },
      include: {
        user: {
          select: { departmentRel: { select: { name: true } } },
        },
      },
    }),
  ])

  if (!exam) return errorResponse('Sınav bulunamadı', 404)

  // Özet hesaplamaları
  const totalAssigned = exam._count.assignments
  const totalCompleted = attempts.filter((a) => a.postExamScore !== null).length
  const totalPassed = attempts.filter((a) => a.isPassed).length
  const totalFailed = totalCompleted - totalPassed
  const scores = attempts
    .map((a) => a.postExamScore)
    .filter((s) => s !== null)
    .map((s) => Number(s))
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0
  const passRate =
    totalCompleted > 0
      ? Math.round((totalPassed / totalCompleted) * 100)
      : 0

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'xlsx'

  // Departman istatistikleri
  const deptMap = new Map<string, { totalAssigned: number; passed: number }>()
  for (const a of assignments) {
    const dept = a.user.departmentRel?.name ?? 'Atanmamış'
    const entry = deptMap.get(dept) ?? { totalAssigned: 0, passed: 0 }
    entry.totalAssigned++
    deptMap.set(dept, entry)
  }
  for (const a of attempts) {
    if (a.isPassed) {
      const dept = a.user.departmentRel?.name ?? 'Atanmamış'
      const entry = deptMap.get(dept)
      if (entry) entry.passed++
    }
  }

  // ── PDF Export ──
  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Header
    doc.setFontSize(16)
    doc.text(sanitizeCell(exam.title) as string, 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(
      `Baraj: ${exam.passingScore}% | ${exam._count.questions} soru | ${exam.startDate.toLocaleDateString('tr-TR')} - ${exam.endDate.toLocaleDateString('tr-TR')}`,
      14,
      28,
    )

    // Summary table
    doc.setTextColor(0)
    ;(doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
      startY: 35,
      head: [['Metrik', 'Deger']],
      body: [
        ['Toplam Atanan', String(totalAssigned)],
        ['Tamamlayan', String(totalCompleted)],
        ['Gecen', String(totalPassed)],
        ['Kalan', String(totalFailed)],
        ['Ortalama Puan', String(avgScore)],
        ['Basari Orani', `%${passRate}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [13, 150, 104] },
      styles: { fontSize: 9 },
    })

    // Department table
    const deptBody = Array.from(deptMap.entries()).map(([dept, stats]) => {
      const rate = stats.totalAssigned > 0 ? Math.round((stats.passed / stats.totalAssigned) * 100) : 0
      return [dept, String(stats.totalAssigned), String(stats.passed), `%${rate}`]
    })

    if (deptBody.length > 0) {
      ;(doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        head: [['Departman', 'Atanan', 'Gecen', 'Basari Orani']],
        body: deptBody,
        theme: 'grid',
        headStyles: { fillColor: [13, 150, 104] },
        styles: { fontSize: 9 },
      })
    }

    // Participants table
    const participantBody = attempts.map((a) => {
      const name = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
      const dept = a.user.departmentRel?.name ?? ''
      const score = a.postExamScore ? Number(a.postExamScore) : 0
      return [name, dept, String(score), a.isPassed ? 'Gecti' : 'Kaldi', String(a.attemptNumber)]
    })

    ;(doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
      head: [['Ad Soyad', 'Departman', 'Puan', 'Durum', 'Deneme']],
      body: participantBody,
      theme: 'grid',
      headStyles: { fillColor: [13, 150, 104] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { cellWidth: 20 },
        4: { cellWidth: 18 },
      },
    })

    const pdfBuffer = doc.output('arraybuffer')
    const dateStr = new Date().toISOString().slice(0, 10)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'standalone_exam.export',
      entityType: 'training',
      entityId: id,
      newData: { format: 'pdf', title: exam.title },
      request,
    })

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sinav-sonuclari-${dateStr}.pdf"`,
      },
    })
  }

  // ── Excel Export ──
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Hospital LMS'
  wb.created = new Date()

  // Sheet 1: Özet
  const wsOzet = wb.addWorksheet('Özet')
  wsOzet.columns = [
    { header: 'Metrik', key: 'metric', width: 30 },
    { header: 'Değer', key: 'value', width: 20 },
  ]
  styleHeader(wsOzet)
  const summaryRows = [
    ['Sınav Adı', sanitizeCell(exam.title)],
    ['Geçme Puanı', exam.passingScore],
    ['Toplam Soru', exam._count.questions],
    ['Başlangıç', exam.startDate.toLocaleDateString('tr-TR')],
    ['Bitiş', exam.endDate.toLocaleDateString('tr-TR')],
    ['Toplam Atanan', totalAssigned],
    ['Tamamlayan', totalCompleted],
    ['Geçen', totalPassed],
    ['Kalan', totalFailed],
    ['Ortalama Puan', avgScore],
    ['Başarı Oranı', `%${passRate}`],
  ]
  for (const [metric, value] of summaryRows) {
    wsOzet.addRow({ metric, value })
  }

  // Sheet 2: Departman Analizi
  const wsDept = wb.addWorksheet('Departman Analizi')
  wsDept.columns = [
    { header: 'Departman', key: 'dept', width: 25 },
    { header: 'Atanan', key: 'assigned', width: 12 },
    { header: 'Geçen', key: 'passed', width: 12 },
    { header: 'Başarı Oranı', key: 'passRate', width: 15 },
  ]
  styleHeader(wsDept)
  for (const [dept, stats] of deptMap.entries()) {
    const rate = stats.totalAssigned > 0 ? Math.round((stats.passed / stats.totalAssigned) * 100) : 0
    wsDept.addRow({
      dept: sanitizeCell(dept),
      assigned: stats.totalAssigned,
      passed: stats.passed,
      passRate: `%${rate}`,
    })
  }

  // Sheet 3: Katılımcı Sonuçları
  const wsResults = wb.addWorksheet('Katılımcı Sonuçları')
  wsResults.columns = [
    { header: 'Ad Soyad', key: 'name', width: 25 },
    { header: 'Departman', key: 'dept', width: 20 },
    { header: 'Deneme No', key: 'attempt', width: 12 },
    { header: 'Puan', key: 'score', width: 10 },
    { header: 'Durum', key: 'status', width: 12 },
    { header: 'Başlangıç', key: 'startedAt', width: 20 },
    { header: 'Bitiş', key: 'completedAt', width: 20 },
    { header: 'Süre (dk)', key: 'duration', width: 12 },
  ]
  styleHeader(wsResults)

  for (const a of attempts) {
    const name = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim()
    const dept = a.user.departmentRel?.name ?? ''
    let duration = 0
    if (a.postExamStartedAt && a.postExamCompletedAt) {
      duration = Math.round(
        (new Date(a.postExamCompletedAt).getTime() -
          new Date(a.postExamStartedAt).getTime()) /
          60000,
      )
    }
    const row = wsResults.addRow({
      name: sanitizeCell(name),
      dept: sanitizeCell(dept),
      attempt: a.attemptNumber,
      score: a.postExamScore ? Number(a.postExamScore) : 0,
      status: a.isPassed ? 'Geçti' : 'Kaldı',
      startedAt: a.postExamStartedAt
        ? new Date(a.postExamStartedAt).toLocaleString('tr-TR')
        : '',
      completedAt: a.postExamCompletedAt
        ? new Date(a.postExamCompletedAt).toLocaleString('tr-TR')
        : '',
      duration,
    })

    // Geçti = yeşil bg, Kaldı = kırmızı bg
    const statusCell = row.getCell('status')
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: a.isPassed ? 'FFD4EDDA' : 'FFF8D7DA' },
    }
  }

  // Sheet 4: Soru Analizi
  const wsQuestions = wb.addWorksheet('Soru Analizi')
  wsQuestions.columns = [
    { header: 'Soru No', key: 'no', width: 10 },
    { header: 'Soru Metni', key: 'text', width: 50 },
    { header: 'Doğru Cevap Oranı', key: 'rate', width: 20 },
    { header: 'Toplam Cevap', key: 'total', width: 15 },
  ]
  styleHeader(wsQuestions)

  const sortedQuestions = questions
    .map((q, idx) => {
      const totalAnswers = q.examAnswers.length
      const correctCount = q.examAnswers.filter((a) => a.isCorrect).length
      return {
        no: idx + 1,
        text: q.questionText,
        rate: totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0,
        total: totalAnswers,
      }
    })
    .sort((a, b) => a.rate - b.rate) // Artan sıralı (en zor sorular üstte)

  for (const q of sortedQuestions) {
    wsQuestions.addRow({
      no: q.no,
      text: sanitizeCell(q.text),
      rate: `%${q.rate}`,
      total: q.total,
    })
  }

  // Buffer'a yaz
  const buffer = await wb.xlsx.writeBuffer()

  const dateStr = new Date().toISOString().slice(0, 10)

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: orgId,
    action: 'standalone_exam.export',
    entityType: 'training',
    entityId: id,
    newData: { format: 'xlsx', title: exam.title },
    request,
  })

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sinav-sonuclari-${dateStr}.xlsx"`,
    },
  })
}
