import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import ExcelJS from 'exceljs'

/**
 * CSV injection koruması — hücre değeri tehlikeli karakterle başlıyorsa
 * tek tırnak ile önekler. =, +, -, @, \t, \r, \n karakterleri Excel'de
 * formül olarak yorumlanabilir.
 */
function sanitizeCellValue(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return `'${str}`
  }
  return str
}

/** Nesne değerlerini CSV injection'a karşı temizler */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = typeof value === 'string' ? sanitizeCellValue(value) : value
  }
  return sanitized
}

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // staff | trainings | results | audit-logs
  const format = searchParams.get('format') ?? 'xlsx' // xlsx | csv
  const dateFromRaw = searchParams.get('dateFrom')
  const dateToRaw = searchParams.get('dateTo')

  /** Parse and validate date string, returns undefined if invalid */
  const parseDate = (raw: string | null): Date | undefined => {
    if (!raw) return undefined
    const d = new Date(raw)
    return isNaN(d.getTime()) ? undefined : d
  }

  const dateFrom = parseDate(dateFromRaw)
  const dateTo = parseDate(dateToRaw)

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const allowed = await checkRateLimit(`export:${orgId}`, 10, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  if (type === 'staff') {
    const staff = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: 'staff',
        ...((dateFrom || dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }),
      },
      include: { departmentRel: { select: { name: true } }, _count: { select: { assignments: true } } },
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
      { header: 'Atanan Eğitim', key: 'assignmentCount', width: 15 },
      { header: 'Kayıt Tarihi', key: 'createdAt', width: 20 },
    ]

    staff.forEach(s => {
      ws.addRow(sanitizeRow({
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        // KVKK: TC No maskeleme — sadece son 4 hane göster
        tcNo: s.tcNo ? `*******${s.tcNo.slice(-4)}` : '',
        // KVKK: Telefon maskeleme — sadece son 3 hane göster
        phone: s.phone ? `***${s.phone.slice(-3)}` : '',
        department: s.departmentRel?.name ?? '',
        title: s.title ?? '',
        isActive: s.isActive ? 'Aktif' : 'Pasif',
        assignmentCount: s._count.assignments,
        createdAt: s.createdAt.toLocaleDateString('tr-TR'),
      }))
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
      where: {
        organizationId: orgId,
        ...(dateFrom && { startDate: { gte: dateFrom } }),
        ...(dateTo && { endDate: { lte: dateTo } }),
      },
      include: { _count: { select: { assignments: true, videos: true, questions: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Eğitimler')

    ws.columns = [
      { header: 'Başlık', key: 'title', width: 40 },
      { header: 'Kategori', key: 'category', width: 15 },
      { header: 'Geçme Notu', key: 'passingScore', width: 12 },
      { header: 'Max Deneme', key: 'maxAttempts', width: 12 },
      { header: 'Süre (dk)', key: 'examDurationMinutes', width: 12 },
      { header: 'Video Sayısı', key: 'videoCount', width: 12 },
      { header: 'Soru Sayısı', key: 'questionCount', width: 12 },
      { header: 'Atanan Kişi', key: 'assignmentCount', width: 12 },
      { header: 'Başlangıç', key: 'startDate', width: 15 },
      { header: 'Bitiş', key: 'endDate', width: 15 },
    ]

    trainings.forEach(t => {
      ws.addRow(sanitizeRow({
        title: t.title,
        category: t.category,
        passingScore: t.passingScore,
        maxAttempts: t.maxAttempts,
        examDurationMinutes: t.examDurationMinutes,
        videoCount: t._count.videos,
        questionCount: t._count.questions,
        assignmentCount: t._count.assignments,
        startDate: t.startDate.toLocaleDateString('tr-TR'),
        endDate: t.endDate.toLocaleDateString('tr-TR'),
      }))
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
    const attempts = await prisma.examAttempt.findMany({
      where: {
        training: { organizationId: orgId },
        ...((dateFrom || dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }),
      },
      include: {
        user: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
        training: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sınav Sonuçları')

    ws.columns = [
      { header: 'Personel', key: 'staff', width: 25 },
      { header: 'Departman', key: 'department', width: 20 },
      { header: 'Eğitim', key: 'training', width: 35 },
      { header: 'Deneme No', key: 'attemptNumber', width: 12 },
      { header: 'Ön Sınav', key: 'preExamScore', width: 10 },
      { header: 'Son Sınav', key: 'postExamScore', width: 10 },
      { header: 'Geçti mi?', key: 'isPassed', width: 10 },
      { header: 'Durum', key: 'status', width: 15 },
      { header: 'Tarih', key: 'date', width: 20 },
    ]

    attempts.forEach(a => {
      ws.addRow(sanitizeRow({
        staff: `${a.user.firstName} ${a.user.lastName}`,
        department: a.user.departmentRel?.name ?? '',
        training: a.training.title,
        attemptNumber: a.attemptNumber,
        preExamScore: a.preExamScore ? Number(a.preExamScore) : '-',
        postExamScore: a.postExamScore ? Number(a.postExamScore) : '-',
        isPassed: a.isPassed ? 'Evet' : 'Hayır',
        status: a.status,
        date: a.createdAt.toLocaleDateString('tr-TR'),
      }))
    })

    styleHeader(ws)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'data.export',
      entityType: 'export',
      entityId: orgId,
      newData: { type, format, rowCount: attempts.length },
    })

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=sinav-sonuclari.xlsx',
      },
    })
  }

  // ── AUDIT LOGS ──
  if (type === 'audit-logs') {
    const dateFilter: Record<string, unknown> = {}
    if (dateFrom) dateFilter.gte = dateFrom
    if (dateTo) dateFilter.lte = dateTo

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        ...(dateFrom || dateTo ? { createdAt: dateFilter } : {}),
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Denetim Kayıtları')
    ws.columns = [
      { header: 'Tarih', key: 'date', width: 20 },
      { header: 'Kullanıcı', key: 'user', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'İşlem', key: 'action', width: 25 },
      { header: 'Varlık Tipi', key: 'entityType', width: 15 },
      { header: 'Varlık ID', key: 'entityId', width: 15 },
      { header: 'IP Adresi', key: 'ip', width: 15 },
    ]

    logs.forEach(log => {
      ws.addRow(sanitizeRow({
        date: log.createdAt.toLocaleString('tr-TR'),
        user: log.user ? `${log.user.firstName} ${log.user.lastName}` : '-',
        email: log.user?.email ?? '-',
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ?? '-',
        ip: log.ipAddress ?? '-',
      }))
    })

    styleHeader(ws)

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'data.export',
      entityType: 'export',
      entityId: orgId,
      newData: { type, format, rowCount: logs.length },
    })

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=denetim-kayitlari.xlsx',
      },
    })
  }

  return errorResponse('Invalid export type. Use: staff, trainings, results, audit-logs')
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9668' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 28
}
