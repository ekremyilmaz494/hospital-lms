import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { buildEgitimSicilFormPdf } from '@/lib/pdf/egitim-sicil-form'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/staff/[id]/training-record
 * Eğitim Kayıt Sicil Formu (SKS) — personelin atandığı TÜM eğitimleri durum + zaman damgası +
 * puan + sertifika numarasıyla tek belgede listeler. org-scoped: başka kurumun personeli export edilemez.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = params
  if (!UUID_RE.test(id)) return errorResponse('Geçersiz personel kimliği', 400)

  const allowed = await checkRateLimit(`report:sicil:${dbUser.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla rapor isteği. Lütfen bekleyin.', 429)

  try {
    const [user, certificates] = await Promise.all([
      prisma.user.findFirst({
        where: { id, organizationId },
        select: {
          firstName: true,
          lastName: true,
          title: true,
          departmentRel: { select: { name: true } },
          organization: { select: { name: true, logoUrl: true } },
          assignments: {
            select: {
              assignedAt: true,
              completedAt: true,
              status: true,
              training: { select: { id: true, title: true, category: true } },
              examAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
                select: { postExamScore: true, postExamCompletedAt: true },
              },
            },
            orderBy: { assignedAt: 'desc' },
          },
        },
      }),
      prisma.certificate.findMany({
        where: { userId: id, organizationId, revokedAt: null },
        select: { trainingId: true, certificateCode: true },
      }),
    ])

    if (!user) return errorResponse('Personel bulunamadı', 404)

    const certByTraining = new Map(certificates.map(c => [c.trainingId, c.certificateCode]))
    const staffName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    const orgName = user.organization?.name ?? 'Kurum'
    const logoDataUrl = await resolveOrgLogoDataUrl(user.organization?.logoUrl)

    const pdf = await buildEgitimSicilFormPdf({
      staffName,
      staffTitle: user.title ?? null,
      department: user.departmentRel?.name ?? null,
      organizationName: orgName,
      logoDataUrl,
      docRef: id.slice(0, 8).toUpperCase(),
      entries: user.assignments.map(a => {
        const attempt = a.examAttempts[0]
        return {
          trainingTitle: a.training.title,
          category: a.training.category,
          assignedAt: a.assignedAt,
          status: a.status,
          score: attempt?.postExamScore != null ? Number(attempt.postExamScore) : null,
          completedAt: a.completedAt ?? attempt?.postExamCompletedAt ?? null,
          certificateCode: certByTraining.get(a.training.id) ?? null,
        }
      }),
    })

    await audit({
      action: 'staff.training_record_export',
      entityType: 'user',
      entityId: id,
      newData: { trainingCount: user.assignments.length },
    })

    const safeName = staffName
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/gi, '_').toLowerCase()

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="egitim_sicil_${safeName || id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('TrainingRecordPDF', 'Sicil formu oluşturulamadı', err)
    return errorResponse('Sicil formu oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
