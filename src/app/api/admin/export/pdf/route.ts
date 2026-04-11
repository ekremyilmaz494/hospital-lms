import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { jsPDF } from 'jspdf'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`pdf-export:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen 1 dakika bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // Geçersiz veya eksik type parametresi → boş PDF yerine hata döndür
  const VALID_PDF_TYPES = ['staff-report', 'training-report', 'exam-report', 'certificates'] as const
  if (!type || !(VALID_PDF_TYPES as readonly string[]).includes(type)) {
    return errorResponse(`Geçersiz rapor tipi. Geçerli değerler: ${VALID_PDF_TYPES.join(', ')}`, 400)
  }

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)
  const org = await prisma.organization.findUnique({ where: { id: orgId } })

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFontSize(20)
  doc.setTextColor(13, 150, 104) // primary color
  doc.text('Devakent Hastanesi', pageWidth / 2, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text(org?.name ?? '', pageWidth / 2, 28, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, pageWidth / 2, 35, { align: 'center' })

  doc.setDrawColor(13, 150, 104)
  doc.line(20, 40, pageWidth - 20, 40)

  if (type === 'staff-report') {
    const staffCount = await prisma.user.count({ where: { organizationId: orgId, role: 'staff' } })
    const activeStaff = await prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } })
    const departments = await prisma.department.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { users: true } } },
    })

    doc.setFontSize(16)
    doc.setTextColor(30)
    doc.text('Personel Raporu', 20, 55)

    doc.setFontSize(11)
    doc.setTextColor(60)
    let y = 70
    doc.text(`Toplam Personel: ${staffCount}`, 20, y); y += 8
    doc.text(`Aktif Personel: ${activeStaff}`, 20, y); y += 8
    doc.text(`Pasif Personel: ${staffCount - activeStaff}`, 20, y); y += 15

    doc.setFontSize(14)
    doc.setTextColor(30)
    doc.text('Departman Dagilimi', 20, y); y += 10

    doc.setFontSize(10)
    doc.setTextColor(60)
    departments.forEach(d => {
      doc.text(`${d.name}: ${d._count.users} kisi`, 25, y)
      y += 7
    })
  }

  if (type === 'training-report') {
    const trainings = await prisma.training.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { assignments: true } },
        assignments: { select: { status: true } },
      },
    })

    doc.setFontSize(16)
    doc.setTextColor(30)
    doc.text('Egitim Raporu', 20, 55)

    doc.setFontSize(10)
    doc.setTextColor(60)
    let y = 70

    trainings.forEach(t => {
      if (y > 270) { doc.addPage(); y = 20 }

      const passed = t.assignments.filter(a => a.status === 'passed').length
      const rate = t.assignments.length > 0 ? Math.round((passed / t.assignments.length) * 100) : 0

      doc.setFontSize(12)
      doc.setTextColor(30)
      doc.text(t.title, 20, y); y += 7

      doc.setFontSize(9)
      doc.setTextColor(80)
      doc.text(`Kategori: ${t.category ?? '-'} | Atanan: ${t._count.assignments} | Basari: %${rate}`, 25, y)
      y += 12
    })
  }

  if (type === 'certificates') {
    const certificates = await prisma.certificate.findMany({
      where: { training: { organizationId: orgId } },
      include: { user: { select: { firstName: true, lastName: true } }, training: { select: { title: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });

    doc.setFontSize(16)
    doc.setTextColor(30)
    doc.text('Sertifika Listesi', 20, 55)

    doc.setFontSize(10)
    doc.setTextColor(60)
    certificates.forEach((cert, i) => {
      const y = 70 + i * 8;
      if (y > 280) return; // sayfa sınırı
      doc.text(`${cert.user.firstName} ${cert.user.lastName} — ${cert.training.title} — ${new Date(cert.issuedAt).toLocaleDateString('tr-TR')}`, 14, y);
    });
  }

  if (type === 'exam-report') {
    const attempts = await prisma.examAttempt.findMany({
      where: { training: { organizationId: orgId }, status: 'completed' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        training: { select: { title: true, passingScore: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    doc.setFontSize(16)
    doc.setTextColor(30)
    doc.text('Sinav Sonuclari Raporu', 20, 55)

    doc.setFontSize(9)
    let y = 70

    // Table header
    doc.setTextColor(255)
    doc.setFillColor(13, 150, 104)
    doc.rect(20, y - 5, pageWidth - 40, 8, 'F')
    doc.text('Personel', 22, y)
    doc.text('Egitim', 70, y)
    doc.text('Puan', 140, y)
    doc.text('Sonuc', 160, y)
    y += 10

    doc.setTextColor(60)
    attempts.forEach(a => {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(`${a.user.firstName} ${a.user.lastName}`, 22, y)
      doc.text(a.training.title.substring(0, 30), 70, y)
      doc.text(a.postExamScore ? `${Number(a.postExamScore)}` : '-', 140, y)
      doc.setTextColor(a.isPassed ? 22 : 220, a.isPassed ? 163 : 38, a.isPassed ? 74 : 38)
      doc.text(a.isPassed ? 'Gecti' : 'Kaldi', 160, y)
      doc.setTextColor(60)
      y += 7
    })
  }

  const pdfBuffer = doc.output('arraybuffer')

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${type ?? 'rapor'}.pdf`,
    },
  })
}
