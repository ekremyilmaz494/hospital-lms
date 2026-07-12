import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { getStaffOrgIds } from '@/lib/staff-orgs'

/**
 * GET /api/exam/[id]/info — SCORM player'ının ihtiyaç duyduğu eğitim özeti.
 * `id` = trainingId (SCORM alt-route'larıyla tutarlı). Org izolasyonu + atama
 * sahipliği (staff) zorlanır — content/tracking route'larıyla aynı sınır.
 */
export const GET = withStaffRoute<{ id: string }>(async ({ params, dbUser, organizationId }) => {
  const { id: trainingId } = params

  try {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        scormEntryPoint: true,
        scormVersion: true,
        organizationId: true,
      },
    })

    if (!training) return errorResponse('Eğitim bulunamadı', 404)

    // Org izolasyonu (super_admin muaf — önizleme). Ortak personel: eğitim doktorun hastanelerinden
    // (primary VEYA aktif üyelik) birine ait olmalı. Tekil-org'da myOrgs=[A] → =A ile birebir.
    const myOrgs = await getStaffOrgIds(dbUser.id, organizationId)
    if (dbUser.role !== 'super_admin' && !myOrgs.includes(training.organizationId)) {
      return errorResponse('Bu eğitimi görüntüleme yetkiniz yok', 403)
    }

    // Atama sahipliği — yalnız 'staff' için (admin/super_admin önizleme yapabilir).
    if (dbUser.role === 'staff') {
      const assignment = await prisma.trainingAssignment.findFirst({
        where: { trainingId, userId: dbUser.id },
        select: { id: true },
      })
      if (!assignment) return errorResponse('Bu eğitim size atanmamış', 403)
    }

    return jsonResponse(
      {
        id: training.id,
        title: training.title,
        description: training.description,
        category: training.category,
        scormEntryPoint: training.scormEntryPoint,
        scormVersion: training.scormVersion,
      },
      200,
      { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    )
  } catch (err) {
    logger.error('Exam Info', 'Eğitim bilgisi alınamadı', err)
    return errorResponse('Eğitim bilgisi alınamadı', 500)
  }
}, { requireOrganization: true })
