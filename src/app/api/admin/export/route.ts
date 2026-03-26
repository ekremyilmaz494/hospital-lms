import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import ExcelJS from 'exceljs'

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
        // KVKK: TC No maskeleme — sadece son 4 hane göster
        tcNo: s.tcNo ? `*******${s.tcNo.slice(-4)}` : '',
        // KVKK: Telefon maskeleme — sadece son 3 hane göster
        phone: s.phone ? `***${s.phone.slice(-3)}` : '',
        isActive: s.isActive ? 'Aktif' : 'Pasif',
        assignmentCount: s._count.assignments,
        createdAt: s.createdAt.toLocaleDateString('tr-TR'),
      })
    })

    styleHeader(ws)

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
      where: { training: { organizationId: orgId } },
      include: {
        user: { select: { firstName: true, lastName: true, department: true } },
        training: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
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
        staff: `${a.user.firstName} ${a.user.lastName}`,
        department: a.user.department,
        training: a.training.title,
        attemptNumber: a.attemptNumber,
        preExamScore: a.preExamScore ? Number(a.preExamScore) : '-',
        postExamScore: a.postExamScore ? Number(a.postExamScore) : '-',
        isPassed: a.isPassed ? 'Evet' : 'Hayir',
        status: a.status,
        date: a.createdAt.toLocaleDateString('tr-TR'),
      })
    })

    styleHeader(ws)

    const buffer = await wb.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=sinav-sonuclari.xlsx',
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
