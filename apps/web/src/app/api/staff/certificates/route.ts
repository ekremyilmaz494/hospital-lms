import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { withCache } from '@/lib/redis'
import { isTrainingAccessible } from '@/lib/training-helpers'
import { getStaffOrgIds } from '@/lib/staff-orgs'

export const GET = withStaffRoute(async ({ request, dbUser, organizationId }) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = safePagination(searchParams)
    const userId = dbUser.id
    // Ortak personel: doktorun TÜM hastanelerindeki sertifikaları tek listede topla.
    // Tekil-org'da myOrgs=[A] → orgScope="A" → cache key + where BİREBİR eski davranış.
    const myOrgs = await getStaffOrgIds(userId, organizationId)
    const orgScope = [...myOrgs].sort().join(',') // üyelik değişince/farklı org-setinde bayat servis etme
    const cacheKey = `cache:${orgScope}:certs:${userId}:${page}:${limit}`

    const data = await withCache(cacheKey, 600, async () => {
      const where = {
        userId,
        training: { organizationId: { in: myOrgs } },
      }

      const [certificates, total] = await Promise.all([
        prisma.certificate.findMany({
          where,
          include: {
            training: { select: { title: true, category: true, isActive: true, publishStatus: true, organization: { select: { name: true } } } },
            attempt: { select: { postExamScore: true, attemptNumber: true } },
            // D1b — saf SCORM sertifikalarında ExamAttempt yok; skor ScormAttempt'ten gelir.
            scormAttempt: { select: { score: true } },
          },
          orderBy: { issuedAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.certificate.count({ where }),
      ])

      const now = new Date()

      return {
        total,
        page,
        limit,
        certificates: certificates.map(c => ({
          id: c.id,
          certificateCode: c.certificateCode,
          issuedAt: c.issuedAt.toISOString(),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          isExpired: c.expiresAt ? new Date(c.expiresAt) < now : false,
          training: {
            title: c.training.title,
            category: c.training.category ?? '',
            isArchived: !isTrainingAccessible(c.training),
          },
          // Ortak personel: sertifikanın hangi hastaneden olduğu (tekil-org'da null → UI etiket basmaz).
          hospitalName: myOrgs.length > 1 ? (c.training.organization?.name ?? null) : null,
          score: c.attempt ? (c.attempt.postExamScore ? Number(c.attempt.postExamScore) : 0) : (c.scormAttempt?.score ?? 0),
          attemptNumber: c.attempt?.attemptNumber ?? 1,
        })),
      }
    })

    return jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' })
  } catch (err) {
    logger.error('Staff Certificates', 'Sertifikalar yüklenemedi', err)
    return errorResponse('Sertifikalar yüklenemedi', 503)
  }
}, { requireOrganization: true })
