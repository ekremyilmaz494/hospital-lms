import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'
import { buildEgitimDuyuruFormPdf } from '@/lib/pdf/egitim-duyuru-form'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/trainings/[id]/announcement-form
 * Eğitim Duyuru Formu (SKS) — eğitimin personellere otomatik bildirimle duyurulduğunu ve
 * kimlere duyurulduğunu zaman damgalı belgeler. org-scoped: başka kurumun eğitimi export edilemez.
 */
export const GET = withAdminRoute<{ id: string }>(async ({ params, dbUser, organizationId, audit }) => {
  const { id } = params
  if (!UUID_RE.test(id)) return errorResponse('Geçersiz eğitim kimliği', 400)

  const allowed = await checkRateLimit(`report:duyuru:${dbUser.id}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla rapor isteği. Lütfen bekleyin.', 429)

  try {
    const [training, notifications] = await Promise.all([
      prisma.training.findFirst({
        where: { id, organizationId },
        select: {
          title: true,
          category: true,
          startDate: true,
          endDate: true,
          isCompulsory: true,
          organization: { select: { name: true, logoUrl: true } },
          assignments: {
            select: {
              userId: true,
              assignedAt: true,
              status: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  title: true,
                  departmentRel: { select: { name: true } },
                },
              },
            },
            orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
          },
        },
      }),
      prisma.notification.findMany({
        where: { relatedTrainingId: id, type: 'assignment', organizationId },
        select: { userId: true, createdAt: true, message: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    if (!training) return errorResponse('Eğitim bulunamadı', 404)

    const notifiedUserIds = new Set(notifications.map(n => n.userId))
    const orgName = training.organization?.name ?? 'Kurum'
    const logoDataUrl = await resolveOrgLogoDataUrl(training.organization?.logoUrl)

    const pdf = await buildEgitimDuyuruFormPdf({
      trainingTitle: training.title,
      category: training.category,
      startDate: training.startDate,
      endDate: training.endDate,
      isCompulsory: training.isCompulsory,
      organizationName: orgName,
      logoDataUrl,
      docRef: id.slice(0, 8).toUpperCase(),
      announcementMessage: notifications[0]?.message ?? null,
      firstAnnouncedAt: notifications[0]?.createdAt ?? null,
      notifiedCount: notifiedUserIds.size,
      staff: training.assignments.map(a => ({
        fullName: `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim(),
        department: a.user.departmentRel?.name ?? '',
        title: a.user.title ?? '',
        assignedAt: a.assignedAt,
        notified: notifiedUserIds.has(a.userId),
        status: a.status,
      })),
    })

    await audit({
      action: 'training.announcement_form_export',
      entityType: 'training',
      entityId: id,
      newData: { assignedCount: training.assignments.length, notifiedCount: notifiedUserIds.size },
    })

    const safeName = training.title
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/gi, '_').toLowerCase()

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}_duyuru_formu.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('AnnouncementFormPDF', 'Duyuru formu oluşturulamadı', err)
    return errorResponse('Duyuru formu oluşturulurken hata oluştu', 500)
  }
}, { requireOrganization: true })
