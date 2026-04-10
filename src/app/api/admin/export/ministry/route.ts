import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { safeDecryptTcNo } from '@/lib/crypto'

/**
 * GET /api/admin/export/ministry
 * Sağlık Bakanlığı'na sunulabilir formatta sertifika raporu.
 * Format: JSON array — Excel/CSV dönüşümü frontend'de yapılır.
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organizasyon bulunamadı', 403)

  const allowed = await checkRateLimit(`ministry-export:${dbUser!.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek, lütfen bekleyin', 429)

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // active | expired | revoked | all
  const trainingId = searchParams.get('trainingId')

  const now = new Date()

  const where = {
    training: { organizationId: orgId },
    ...(trainingId ? { trainingId } : {}),
    ...(status === 'active' ? { expiresAt: { gt: now }, revokedAt: null } : {}),
    ...(status === 'expired' ? { expiresAt: { lt: now }, revokedAt: null } : {}),
    ...(status === 'revoked' ? { revokedAt: { not: null } } : {}),
  }

  const certificates = await prisma.certificate.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          tcNo: true,
          title: true,
          departmentRel: { select: { name: true } },
        },
      },
      training: {
        select: {
          title: true,
          category: true,
          regulatoryBody: true,
          renewalPeriodMonths: true,
          isCompulsory: true,
        },
      },
      attempt: {
        select: { postExamScore: true, attemptNumber: true },
      },
    },
    orderBy: { issuedAt: 'desc' },
  })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, code: true },
  })

  const report = certificates.map((cert) => ({
    // Kurum Bilgileri
    kurumAdi: org?.name ?? '',
    kurumKodu: org?.code ?? '',
    // Personel Bilgileri
    tcKimlikNo: safeDecryptTcNo(cert.user.tcNo) ?? '',
    personelAdi: `${cert.user.firstName} ${cert.user.lastName}`,
    personelEposta: cert.user.email,
    unvan: cert.user.title ?? '',
    departman: cert.user.departmentRel?.name ?? '',
    // Eğitim Bilgileri
    egitimAdi: cert.training.title,
    egitimKategorisi: cert.training.category,
    duzenlayiciKurum: cert.training.regulatoryBody ?? '',
    zorunluEgitim: cert.training.isCompulsory ? 'Evet' : 'Hayır',
    yenilemeSuresiAy: cert.training.renewalPeriodMonths ?? '',
    // Sınav Bilgileri
    sinavPuani: cert.attempt.postExamScore ? Number(cert.attempt.postExamScore) : '',
    denemeSayisi: cert.attempt.attemptNumber,
    // Sertifika Bilgileri
    sertifikaKodu: cert.certificateCode,
    verilisTarihi: cert.issuedAt.toLocaleDateString('tr-TR'),
    gecerlilikBitisTarihi: cert.expiresAt ? cert.expiresAt.toLocaleDateString('tr-TR') : 'Süresiz',
    durum: cert.revokedAt
      ? 'İptal Edildi'
      : cert.expiresAt && cert.expiresAt < now
        ? 'Süresi Dolmuş'
        : 'Aktif',
    iptalTarihi: cert.revokedAt ? cert.revokedAt.toLocaleDateString('tr-TR') : '',
    iptalNedeni: cert.revocationReason ?? '',
  }))

  return jsonResponse(
    {
      raporTarihi: now.toLocaleDateString('tr-TR'),
      kurumAdi: org?.name ?? '',
      kurumKodu: org?.code ?? '',
      toplamSertifika: report.length,
      aktifSertifika: report.filter(r => r.durum === 'Aktif').length,
      suresiDolmus: report.filter(r => r.durum === 'Süresi Dolmuş').length,
      iptalEdilmis: report.filter(r => r.durum === 'İptal Edildi').length,
      sertifikalar: report,
    },
    200,
    { 'Cache-Control': 'private, no-store' }
  )
}
