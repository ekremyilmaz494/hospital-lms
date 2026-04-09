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
import { logger } from '@/lib/logger'

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

/** Personel durumu: Başlamadı / Devam Ediyor / Geçti / Kaldı */
function getPersonStatus(
  hasAttempt: boolean,
  isCompleted: boolean,
  isPassed: boolean,
): string {
  if (!hasAttempt) return 'Başlamadı'
  if (!isCompleted) return 'Devam Ediyor'
  return isPassed ? 'Geçti' : 'Kaldı'
}

interface PersonRow {
  name: string
  dept: string
  status: string
  attemptNumber: number
  score: number | null
  durationMinutes: number
  startedAt: string
  completedAt: string
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

  try {
    // Paralel sorgular
    const [exam, allAttempts, questions, assignments] = await Promise.all([
      prisma.training.findFirst({
        where: { id, organizationId: orgId, examOnly: true },
        include: { _count: { select: { questions: true, assignments: true } } },
      }),
      // TÜM denemeler (sadece completed değil)
      prisma.examAttempt.findMany({
        where: { trainingId: id },
        include: {
          user: {
            select: {
              id: true,
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentRel: { select: { name: true } },
            },
          },
        },
      }),
    ])

    if (!exam) return errorResponse('Sınav bulunamadı', 404)

    // Her kullanıcının en son denemesini bul
    const userBestAttemptMap = new Map<string, typeof allAttempts[number]>()
    for (const attempt of allAttempts) {
      const existing = userBestAttemptMap.get(attempt.user.id)
      // En yüksek puanlı tamamlanmış denemeyi veya en son denemeyi tut
      if (!existing) {
        userBestAttemptMap.set(attempt.user.id, attempt)
      } else if (
        attempt.status === 'completed' &&
        existing.status !== 'completed'
      ) {
        userBestAttemptMap.set(attempt.user.id, attempt)
      } else if (
        attempt.status === 'completed' &&
        existing.status === 'completed' &&
        (attempt.postExamScore ?? 0) > (existing.postExamScore ?? 0)
      ) {
        userBestAttemptMap.set(attempt.user.id, attempt)
      }
    }

    // Tüm atanan personelin satırlarını oluştur
    const personRows: PersonRow[] = assignments.map((assignment) => {
      const userId = assignment.user.id
      const name = `${assignment.user.firstName ?? ''} ${assignment.user.lastName ?? ''}`.trim()
      const dept = assignment.user.departmentRel?.name ?? ''
      const attempt = userBestAttemptMap.get(userId)

      if (!attempt) {
        return {
          name,
          dept,
          status: getPersonStatus(false, false, false),
          attemptNumber: 0,
          score: null,
          durationMinutes: 0,
          startedAt: '',
          completedAt: '',
        }
      }

      const isCompleted = attempt.status === 'completed'
      let durationMinutes = 0
      if (attempt.postExamStartedAt && attempt.postExamCompletedAt) {
        durationMinutes = Math.round(
          (new Date(attempt.postExamCompletedAt).getTime() -
            new Date(attempt.postExamStartedAt).getTime()) /
            60000,
        )
      }

      return {
        name,
        dept,
        status: getPersonStatus(true, isCompleted, attempt.isPassed),
        attemptNumber: attempt.attemptNumber,
        score: isCompleted && attempt.postExamScore !== null
          ? Number(attempt.postExamScore)
          : null,
        durationMinutes,
        startedAt: attempt.postExamStartedAt
          ? new Date(attempt.postExamStartedAt).toLocaleString('tr-TR')
          : '',
        completedAt: attempt.postExamCompletedAt
          ? new Date(attempt.postExamCompletedAt).toLocaleString('tr-TR')
          : '',
      }
    })

    // Duruma göre sırala: Geçti > Kaldı > Devam Ediyor > Başlamadı
    const statusOrder: Record<string, number> = {
      'Geçti': 0,
      'Kaldı': 1,
      'Devam Ediyor': 2,
      'Başlamadı': 3,
    }
    personRows.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))

    // Özet hesaplamaları
    const completedAttempts = allAttempts.filter((a) => a.status === 'completed')
    const totalAssigned = exam._count.assignments
    const totalCompleted = completedAttempts.filter((a) => a.postExamScore !== null).length
    const totalPassed = completedAttempts.filter((a) => a.isPassed).length
    const totalFailed = totalCompleted - totalPassed
    const totalNotStarted = personRows.filter((r) => r.status === 'Başlamadı').length
    const totalInProgress = personRows.filter((r) => r.status === 'Devam Ediyor').length
    const scores = completedAttempts
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
    const deptMap = new Map<string, { totalAssigned: number; passed: number; notStarted: number }>()
    for (const a of assignments) {
      const dept = a.user.departmentRel?.name ?? 'Atanmamış'
      const entry = deptMap.get(dept) ?? { totalAssigned: 0, passed: 0, notStarted: 0 }
      entry.totalAssigned++
      if (!userBestAttemptMap.has(a.user.id)) entry.notStarted++
      deptMap.set(dept, entry)
    }
    for (const a of completedAttempts) {
      if (a.isPassed) {
        const dept = a.user.departmentRel?.name ?? 'Atanmamış'
        const entry = deptMap.get(dept)
        if (entry) entry.passed++
      }
    }

    // ── PDF Export ──
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

      // Header
      doc.setFontSize(16)
      doc.text(sanitizeCell(exam.title) as string, 14, 15)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(
        `Baraj: ${exam.passingScore}% | ${exam._count.questions} soru | Olusturma: ${new Date().toLocaleDateString('tr-TR')}`,
        14,
        22,
      )

      // Summary line
      doc.setFontSize(9)
      doc.text(
        `Toplam: ${totalAssigned} | Gecen: ${totalPassed} | Kalan: ${totalFailed} | Devam Eden: ${totalInProgress} | Baslamadi: ${totalNotStarted} | Basari: %${passRate} | Ort. Puan: ${avgScore}`,
        14,
        28,
      )

      // Participants table — TÜM personel
      doc.setTextColor(0)
      const participantBody = personRows.map((r) => [
        r.name,
        r.dept,
        r.status,
        r.score !== null ? String(r.score) : '-',
        r.attemptNumber > 0 ? String(r.attemptNumber) : '-',
        r.durationMinutes > 0 ? `${r.durationMinutes} dk` : '-',
        r.completedAt || '-',
      ])

      ;(doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }).autoTable({
        startY: 33,
        head: [['Ad Soyad', 'Departman', 'Durum', 'Puan', 'Deneme', 'Sure', 'Tamamlanma']],
        body: participantBody,
        theme: 'grid',
        headStyles: { fillColor: [13, 150, 104], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 20 },
          6: { cellWidth: 35 },
        },
        didParseCell: (data: Record<string, unknown>) => {
          const cellData = data as { section: string; column: { index: number }; cell: { styles: Record<string, unknown>; text: string[] } }
          if (cellData.section === 'body' && cellData.column.index === 2) {
            const text = cellData.cell.text[0]
            if (text === 'Gecti') {
              cellData.cell.styles.fillColor = [212, 237, 218]
              cellData.cell.styles.textColor = [21, 87, 36]
            } else if (text === 'Kaldi') {
              cellData.cell.styles.fillColor = [248, 215, 218]
              cellData.cell.styles.textColor = [114, 28, 36]
            } else if (text === 'Devam Ediyor') {
              cellData.cell.styles.fillColor = [255, 243, 205]
              cellData.cell.styles.textColor = [133, 100, 4]
            } else if (text === 'Baslamadi') {
              cellData.cell.styles.fillColor = [226, 232, 240]
              cellData.cell.styles.textColor = [71, 85, 105]
            }
          }
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
    const wsOzet = wb.addWorksheet('Ozet')
    wsOzet.columns = [
      { header: 'Metrik', key: 'metric', width: 30 },
      { header: 'Deger', key: 'value', width: 20 },
    ]
    styleHeader(wsOzet)
    const summaryRows: [string, string | number][] = [
      ['Sinav Adi', sanitizeCell(exam.title) as string],
      ['Gecme Puani', exam.passingScore],
      ['Toplam Soru', exam._count.questions],
      ['Baslangic', exam.startDate.toLocaleDateString('tr-TR')],
      ['Bitis', exam.endDate.toLocaleDateString('tr-TR')],
      ['Toplam Atanan', totalAssigned],
      ['Tamamlayan', totalCompleted],
      ['Gecen', totalPassed],
      ['Kalan', totalFailed],
      ['Devam Eden', totalInProgress],
      ['Baslamadi', totalNotStarted],
      ['Ortalama Puan', avgScore],
      ['Basari Orani', `%${passRate}`],
    ]
    for (const [metric, value] of summaryRows) {
      wsOzet.addRow({ metric, value })
    }

    // Sheet 2: Departman Analizi
    const wsDept = wb.addWorksheet('Departman Analizi')
    wsDept.columns = [
      { header: 'Departman', key: 'dept', width: 25 },
      { header: 'Atanan', key: 'assigned', width: 12 },
      { header: 'Gecen', key: 'passed', width: 12 },
      { header: 'Baslamadi', key: 'notStarted', width: 14 },
      { header: 'Basari Orani', key: 'passRate', width: 15 },
    ]
    styleHeader(wsDept)
    for (const [dept, stats] of deptMap.entries()) {
      const rate = stats.totalAssigned > 0 ? Math.round((stats.passed / stats.totalAssigned) * 100) : 0
      wsDept.addRow({
        dept: sanitizeCell(dept),
        assigned: stats.totalAssigned,
        passed: stats.passed,
        notStarted: stats.notStarted,
        passRate: `%${rate}`,
      })
    }

    // Sheet 3: Personel Ilerleme — TÜM atanan personel
    const wsResults = wb.addWorksheet('Personel Ilerleme')
    wsResults.columns = [
      { header: 'Ad Soyad', key: 'name', width: 25 },
      { header: 'Departman', key: 'dept', width: 20 },
      { header: 'Durum', key: 'status', width: 16 },
      { header: 'Puan', key: 'score', width: 10 },
      { header: 'Deneme No', key: 'attempt', width: 12 },
      { header: 'Sure (dk)', key: 'duration', width: 12 },
      { header: 'Baslangic', key: 'startedAt', width: 20 },
      { header: 'Tamamlanma', key: 'completedAt', width: 20 },
    ]
    styleHeader(wsResults)

    const statusColors: Record<string, string> = {
      'Gecti': 'FFD4EDDA',
      'Kaldi': 'FFF8D7DA',
      'Devam Ediyor': 'FFFFF3CD',
      'Baslamadi': 'FFE2E8F0',
    }

    for (const r of personRows) {
      const row = wsResults.addRow({
        name: sanitizeCell(r.name),
        dept: sanitizeCell(r.dept),
        status: r.status,
        score: r.score !== null ? r.score : '-',
        attempt: r.attemptNumber > 0 ? r.attemptNumber : '-',
        duration: r.durationMinutes > 0 ? r.durationMinutes : '-',
        startedAt: r.startedAt || '-',
        completedAt: r.completedAt || '-',
      })

      const statusCell = row.getCell('status')
      const bgColor = statusColors[r.status]
      if (bgColor) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        }
      }
    }

    // Sheet 4: Soru Analizi
    const wsQuestions = wb.addWorksheet('Soru Analizi')
    wsQuestions.columns = [
      { header: 'Soru No', key: 'no', width: 10 },
      { header: 'Soru Metni', key: 'text', width: 50 },
      { header: 'Dogru Cevap Orani', key: 'rate', width: 20 },
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
      .sort((a, b) => a.rate - b.rate)

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
  } catch (err) {
    logger.error('exam-export', 'Export failed', { examId: id, error: err })
    return errorResponse('Disa aktarma sirasinda bir hata olustu', 500)
  }
}
