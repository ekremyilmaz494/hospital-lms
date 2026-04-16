import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { jsPDF } from 'jspdf'

const BRAND_RGB: [number, number, number] = [13, 150, 104]
const PAGE_BOTTOM_MARGIN = 280
const LINE_HEIGHT = 7

type CertStatus = 'all' | 'active' | 'expired' | 'revoked'
type CertFormat = 'list' | 'bundle'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const allowed = await checkRateLimit(`pdf-export:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla dışa aktarma isteği. Lütfen 1 dakika bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  const VALID_PDF_TYPES = ['staff-report', 'training-report', 'exam-report', 'certificates'] as const
  if (!type || !(VALID_PDF_TYPES as readonly string[]).includes(type)) {
    return errorResponse(`Geçersiz rapor tipi. Geçerli değerler: ${VALID_PDF_TYPES.join(', ')}`, 400)
  }

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)
  const org = await prisma.organization.findUnique({ where: { id: orgId } })

  if (type === 'certificates') {
    return generateCertificatesPdf(request, orgId, org?.name ?? '')
  }

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(20)
  doc.setTextColor(...BRAND_RGB)
  doc.text('Devakent Hastanesi', pageWidth / 2, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text(org?.name ?? '', pageWidth / 2, 28, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, pageWidth / 2, 35, { align: 'center' })

  doc.setDrawColor(...BRAND_RGB)
  doc.line(20, 40, pageWidth - 20, 40)

  if (type === 'staff-report') {
    const [staffCount, activeStaff, departments] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
      prisma.department.findMany({
        where: { organizationId: orgId },
        include: { _count: { select: { users: true } } },
      }),
    ])

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

    doc.setTextColor(255)
    doc.setFillColor(...BRAND_RGB)
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

async function generateCertificatesPdf(request: Request, orgId: string, orgName: string): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const trainingId = searchParams.get('trainingId') ?? undefined
  const category = searchParams.get('category') ?? undefined
  const search = (searchParams.get('search') ?? '').trim()
  const statusParam = (searchParams.get('status') ?? 'all') as CertStatus
  const format = (searchParams.get('format') ?? 'list') as CertFormat

  const now = new Date()

  const certificates = await prisma.certificate.findMany({
    where: {
      training: {
        organizationId: orgId,
        ...(trainingId && { id: trainingId }),
        ...(category && { category }),
      },
      ...(search && {
        OR: [
          { certificateCode: { contains: search, mode: 'insensitive' as const } },
          { user: { firstName: { contains: search, mode: 'insensitive' as const } } },
          { user: { lastName: { contains: search, mode: 'insensitive' as const } } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    },
    select: {
      id: true,
      certificateCode: true,
      issuedAt: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { firstName: true, lastName: true, title: true, departmentRel: { select: { name: true } } } },
      training: { select: { title: true, category: true } },
      attempt: { select: { postExamScore: true, attemptNumber: true } },
    },
    orderBy: { issuedAt: 'desc' },
    take: trainingId ? undefined : 1000,
  })

  const filtered = certificates.filter(c => {
    if (statusParam === 'active') return !c.revokedAt && (!c.expiresAt || c.expiresAt >= now)
    if (statusParam === 'expired') return !c.revokedAt && c.expiresAt && c.expiresAt < now
    if (statusParam === 'revoked') return !!c.revokedAt
    return true
  })

  if (format === 'bundle') {
    return renderCertificateBundlePdf(filtered, orgName, trainingId)
  }

  return renderCertificateListPdf(filtered, orgName, trainingId)
}

type CertListItem = {
  certificateCode: string
  issuedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  user: { firstName: string; lastName: string; title: string | null; departmentRel: { name: string } | null }
  training: { title: string; category: string | null }
  attempt: { postExamScore: { toString: () => string } | null; attemptNumber: number }
}

function renderCertificateListPdf(certs: CertListItem[], orgName: string, trainingId?: string): Response {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const now = new Date()

  const groupTitle = trainingId && certs[0] ? ` — ${certs[0].training.title}` : ''

  const drawHeader = () => {
    doc.setFontSize(18)
    doc.setTextColor(...BRAND_RGB)
    doc.text('Devakent Hastanesi', pageWidth / 2, 18, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(orgName, pageWidth / 2, 25, { align: 'center' })
    doc.setFontSize(14)
    doc.setTextColor(30)
    doc.text(`Sertifika Listesi${groupTitle}`, pageWidth / 2, 35, { align: 'center' })
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(
      `Rapor Tarihi: ${now.toLocaleDateString('tr-TR')}  ·  Toplam: ${certs.length} sertifika`,
      pageWidth / 2,
      41,
      { align: 'center' },
    )
    doc.setDrawColor(...BRAND_RGB)
    doc.line(14, 45, pageWidth - 14, 45)
  }

  const drawTableHeader = (y: number) => {
    doc.setFillColor(...BRAND_RGB)
    doc.rect(14, y - 5, pageWidth - 28, 8, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255)
    doc.text('#', 16, y)
    doc.text('Personel', 22, y)
    doc.text('Eğitim', 78, y)
    doc.text('Kod', 130, y)
    doc.text('Puan', 165, y)
    doc.text('Durum', 180, y)
    return y + 7
  }

  drawHeader()
  let y = drawTableHeader(55)

  doc.setFontSize(8.5)
  doc.setTextColor(40)

  certs.forEach((c, i) => {
    if (y > PAGE_BOTTOM_MARGIN) {
      doc.addPage()
      drawHeader()
      y = drawTableHeader(55)
      doc.setFontSize(8.5)
      doc.setTextColor(40)
    }

    const score = c.attempt.postExamScore ? `${Number(c.attempt.postExamScore)}%` : '-'
    const status = c.revokedAt
      ? 'İptal'
      : c.expiresAt && c.expiresAt < now
        ? 'Süresi Dolmuş'
        : 'Aktif'
    const statusColor: [number, number, number] = c.revokedAt
      ? [120, 120, 120]
      : c.expiresAt && c.expiresAt < now
        ? [220, 38, 38]
        : [22, 163, 74]

    doc.setTextColor(40)
    doc.text(`${i + 1}`, 16, y)
    doc.text(`${c.user.firstName} ${c.user.lastName}`.substring(0, 30), 22, y)
    doc.text(c.training.title.substring(0, 28), 78, y)
    doc.setFontSize(7.5)
    doc.text(c.certificateCode.substring(0, 20), 130, y)
    doc.setFontSize(8.5)
    doc.text(score, 165, y)
    doc.setTextColor(...statusColor)
    doc.text(status, 180, y)
    y += LINE_HEIGHT
  })

  const pdfBuffer = doc.output('arraybuffer')
  const filename = trainingId ? `sertifika-listesi-${trainingId}.pdf` : 'sertifika-listesi.pdf'
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  })
}

function renderCertificateBundlePdf(certs: CertListItem[], orgName: string, trainingId?: string): Response {
  const MAX_BUNDLE = 200
  if (certs.length > MAX_BUNDLE) {
    return errorResponse(`Sertifika paketi en fazla ${MAX_BUNDLE} sertifika içerebilir. Filtre daraltın.`, 400)
  }
  if (certs.length === 0) {
    return errorResponse('İndirilecek sertifika bulunamadı', 404)
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const pageH = 210

  certs.forEach((c, i) => {
    if (i > 0) doc.addPage('a4', 'landscape')
    drawCertificatePage(doc, c, orgName, pageW, pageH)
  })

  const pdfBuffer = doc.output('arraybuffer')
  const filename = trainingId ? `sertifika-paketi-${trainingId}.pdf` : 'sertifika-paketi.pdf'
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  })
}

function drawCertificatePage(doc: jsPDF, c: CertListItem, orgName: string, w: number, h: number) {
  const now = new Date()
  const isRevoked = !!c.revokedAt
  const isExpired = !isRevoked && !!c.expiresAt && c.expiresAt < now

  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, w, h, 'F')

  doc.setDrawColor(...BRAND_RGB)
  doc.setLineWidth(1.2)
  doc.rect(8, 8, w - 16, h - 16)
  doc.setLineWidth(0.3)
  doc.setDrawColor(203, 213, 225)
  doc.rect(11, 11, w - 22, h - 22)

  doc.setFillColor(...BRAND_RGB)
  doc.rect(w / 2 - 35, 12, 70, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(15, 23, 42)
  doc.text('TAMAMLAMA SERTİFİKASI', w / 2, 35, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(100, 116, 139)
  doc.text(`Devakent Hastanesi — ${orgName}`, w / 2, 43, { align: 'center' })

  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(w / 2 - 50, 52, w / 2 + 50, 52)

  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text('BU SERTİFİKA', w / 2, 62, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(15, 23, 42)
  doc.text(`${c.user.firstName} ${c.user.lastName}`, w / 2, 74, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  const subtitle = [c.user.departmentRel?.name, c.user.title].filter(Boolean).join(' · ') || 'Personel'
  doc.text(subtitle, w / 2, 81, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text('adlı personele, aşağıdaki eğitimi başarıyla tamamladığı için verilmiştir.', w / 2, 92, { align: 'center' })

  doc.line(w / 2 - 50, 100, w / 2 + 50, 100)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...BRAND_RGB)
  doc.text(c.training.title, w / 2, 112, { align: 'center' })

  if (c.training.category) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(c.training.category, w / 2, 119, { align: 'center' })
  }

  const boxY = 130
  const boxW = 55
  const gap = 8
  const totalW = boxW * 3 + gap * 2
  const startX = (w - totalW) / 2

  const score = c.attempt.postExamScore ? `${Number(c.attempt.postExamScore)}%` : '-'
  const statusText = isRevoked ? 'İptal Edilmiş' : isExpired ? 'Süresi Dolmuş' : 'Aktif'

  ;[
    { label: 'PUAN', value: score },
    { label: 'DENEME', value: `${c.attempt.attemptNumber}.` },
    { label: 'DURUM', value: statusText },
  ].forEach((b, idx) => {
    const x = startX + idx * (boxW + gap)
    doc.setFillColor(241, 245, 249)
    doc.rect(x, boxY, boxW, 20, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(b.label, x + boxW / 2, boxY + 7, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text(b.value, x + boxW / 2, boxY + 15, { align: 'center' })
  })

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(30, 170, w - 30, 170)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('SERTİFİKA KODU', 30, 178)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND_RGB)
  doc.text(c.certificateCode, 30, 184)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text('VERİLİŞ TARİHİ', w / 2, 178, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(c.issuedAt.toLocaleDateString('tr-TR'), w / 2, 184, { align: 'center' })

  if (c.expiresAt) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('GEÇERLİLİK TARİHİ', w - 30, 178, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(isExpired ? 220 : 15, isExpired ? 38 : 23, isExpired ? 38 : 42)
    doc.text(c.expiresAt.toLocaleDateString('tr-TR'), w - 30, 184, { align: 'right' })
  }

  doc.setFillColor(...BRAND_RGB)
  doc.rect(w / 2 - 25, h - 16, 50, 1.5, 'F')

  if (isRevoked) {
    doc.setFillColor(239, 68, 68)
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.rect(w / 2 - 35, h / 2 - 5, 70, 12, 'F')
    doc.text('İPTAL EDİLMİŞ', w / 2, h / 2 + 3, { align: 'center' })
  }
}
