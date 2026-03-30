import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import ExcelJS from 'exceljs'

const XLSX_MAX_ROWS = 5000
const CSV_BATCH_SIZE = 500

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // staff | trainings | results | audit-logs
  const format = searchParams.get('format') ?? 'xlsx' // xlsx | csv

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const allowed = await checkRateLimit(`export:${orgId}`, 10, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  if (type === 'staff') {
    const staff = await prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' },
      include: { _count: { select: { assignments: true } } },
      orderBy: { lastName: 'asc' },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Personel')

    ws.columns = [
      { header: 'Ad', key: 'firstName', width: 15 },
      { header: 'Soyad', key: 'lastName', width: 15 },
      { header: 'E-posta', key: 'email', width: 30 },
      { header: 'TC No', key: 'tcNo', width: 15 },
      { header: 'Telefon', key: 'phone', width: 15 },
      { header: 'Departman', key: 'department', width: 20 },
      { header: 'Unvan', key: 'title', width: 20 },
      { header: 'Durum', key: 'isActive', width: 10 },
      { header: 'Atanan Egitim', key: 'assignmentCount', width: 15 },
      { header: 'Kayit Tarihi', key: 'createdAt', width: 20 },
    ]

    staff.forEach(s => {
      ws.addRow({
        ...s,
        firstName: sanitizeCell(s.firstName ?? ''),
        lastName: sanitizeCell(s.lastName ?? ''),
        email: sanitizeCell(s.email),
        // KVKK: TC No maskeleme — sadece son 4 hane göster
        tcNo: s.tcNo ? `*******${s.tcNo.slice(-4)}` : '',
        // KVKK: Telefon maskeleme — sadece son 3 hane göster
        phone: s.phone ? `***${s.phone.slice(-3)}` : '',
        department: sanitizeCell(s.department ?? ''),
        title: sanitizeCell(s.title ?? ''),
        isActive: s.isActive ? 'Aktif' : 'Pasif',
        assignmentCount: s._count.assignments,
        createdAt: s.createdAt.toLocaleDateString('tr-TR'),
      })
    })

    styleHeader(ws)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'data.export',
      entityType: 'export',
      entityId: orgId,
      newData: { type, format, rowCount: staff.length },
    })

    if (format === 'csv') {
      const csv = await wb.csv.writeBuffer()
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=personel.csv',
        },
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=personel.xlsx',
      },
    })
  }

  if (type === 'trainings') {
    const trainings = await prisma.training.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { assignments: true, videos: true, questions: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Egitimler')

    ws.columns = [
      { header: 'Baslik', key: 'title', width: 40 },
      { header: 'Kategori', key: 'category', width: 15 },
      { header: 'Gecme Notu', key: 'passingScore', width: 12 },
      { header: 'Max Deneme', key: 'maxAttempts', width: 12 },
      { header: 'Sure (dk)', key: 'examDurationMinutes', width: 12 },
      { header: 'Video Sayisi', key: 'videoCount', width: 12 },
      { header: 'Soru Sayisi', key: 'questionCount', width: 12 },
      { header: 'Atanan Kisi', key: 'assignmentCount', width: 12 },
      { header: 'Baslangic', key: 'startDate', width: 15 },
      { header: 'Bitis', key: 'endDate', width: 15 },
    ]

    trainings.forEach(t => {
      ws.addRow({
        ...t,
        videoCount: t._count.videos,
        questionCount: t._count.questions,
        assignmentCount: t._count.assignments,
        startDate: t.startDate.toLocaleDateString('tr-TR'),
        endDate: t.endDate.toLocaleDateString('tr-TR'),
      })
    })

    styleHeader(ws)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'data.export',
      entityType: 'export',
      entityId: orgId,
      newData: { type, format, rowCount: trainings.length },
    })

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=egitimler.xlsx',
      },
    })
  }

  if (type === 'results') {
    // G6.2 — CSV: streaming response with cursor-based batching (no full memory load)
    if (format === 'csv') {
      const totalCount = await prisma.examAttempt.count({ where: { training: { organizationId: orgId } } })

      await createAuditLog({
        userId: dbUser!.id,
        organizationId: orgId,
        action: 'data.export',
        entityType: 'export',
        entityId: orgId,
        newData: { type, format: 'csv', rowCount: totalCount, streaming: true },
      })

      const encoder = new TextEncoder()
      const csvHeader = 'Personel,Departman,Egitim,Deneme No,On Sinav,Son Sinav,Gecti mi?,Durum,Tarih\n'

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('\uFEFF')) // BOM for Excel UTF-8
          controller.enqueue(encoder.encode(csvHeader))
          let skip = 0
          while (true) {
            const batch = await prisma.examAttempt.findMany({
              where: { training: { organizationId: orgId } },
              include: {
                user: { select: { firstName: true, lastName: true, department: true } },
                training: { select: { title: true } },
              },
              orderBy: { createdAt: 'desc' },
              skip,
              take: CSV_BATCH_SIZE,
            })
            if (batch.length === 0) break
            for (const a of batch) {
              const row = [
                csvCell(sanitizeCell(`${a.user.firstName} ${a.user.lastName}`)),
                csvCell(sanitizeCell(a.user.department ?? '')),
                csvCell(sanitizeCell(a.training.title)),
                String(a.attemptNumber),
                a.preExamScore != null ? String(Number(a.preExamScore)) : '',
                a.postExamScore != null ? String(Number(a.postExamScore)) : '',
                a.isPassed ? 'Evet' : 'Hayir',
                a.status,
                a.createdAt.toLocaleDateString('tr-TR'),
              ].join(',') + '\n'
              controller.enqueue(encoder.encode(row))
            }
            if (batch.length < CSV_BATCH_SIZE) break
            skip += CSV_BATCH_SIZE
          }
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=sinav-sonuclari.csv',
          'X-Total-Rows': String(totalCount),
        },
      })
    }

    // XLSX: buffered, max XLSX_MAX_ROWS rows
    const attempts = await prisma.examAttempt.findMany({
      where: { training: { organizationId: orgId } },
      include: {
        user: { select: { firstName: true, lastName: true, department: true } },
        training: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: XLSX_MAX_ROWS,
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sinav Sonuclari')

    ws.columns = [
      { header: 'Personel', key: 'staff', width: 25 },
      { header: 'Departman', key: 'department', width: 20 },
      { header: 'Egitim', key: 'training', width: 35 },
      { header: 'Deneme No', key: 'attemptNumber', width: 12 },
      { header: 'On Sinav', key: 'preExamScore', width: 10 },
      { header: 'Son Sinav', key: 'postExamScore', width: 10 },
      { header: 'Gecti mi?', key: 'isPassed', width: 10 },
      { header: 'Durum', key: 'status', width: 15 },
      { header: 'Tarih', key: 'date', width: 20 },
    ]

    attempts.forEach(a => {
      ws.addRow({
        staff: sanitizeCell(`${a.user.firstName} ${a.user.lastName}`),
        department: sanitizeCell(a.user.department ?? ''),
        training: sanitizeCell(a.training.title),
        attemptNumber: a.attemptNumber,
        preExamScore: a.preExamScore != null ? Number(a.preExamScore) : '-',
        postExamScore: a.postExamScore != null ? Number(a.postExamScore) : '-',
        isPassed: a.isPassed ? 'Evet' : 'Hayir',
        status: a.status,
        date: a.createdAt.toLocaleDateString('tr-TR'),
      })
    })

    styleHeader(ws)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'data.export',
      entityType: 'export',
      entityId: orgId,
      newData: { type, format: 'xlsx', rowCount: attempts.length },
    })

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=sinav-sonuclari.xlsx',
        'X-Total-Rows': String(attempts.length),
      },
    })
  }

  return errorResponse('Invalid export type. Use: staff, trainings, results')
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 28
}

/** G6.2 — CSV hücresi: içindeki " karakterini kaçır, değeri tırnak içine al */
function csvCell(value: string | number): string {
  const str = String(value)
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * B6.4/G6.3 — ExcelJS string hücrelerini formula injection'a karşı temizle.
 * XLSX formatı değerleri string olarak depolar ama dışa CSV aktarıldığında
 * açılan programda (Excel, Sheets) formül olarak yorumlanabilir.
 */
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}
