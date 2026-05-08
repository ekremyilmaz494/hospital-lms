import { prisma } from '@/lib/prisma';
import { jsonResponse } from '@/lib/api-helpers';
import { withAdminRoute } from '@/lib/api-handler';

/**
 * GET /api/admin/bulk-assign/existing?trainingIds=a,b,c
 * Seçilen eğitimler için (TÜM dönemler dahil) zaten atanmış
 * (trainingId, userId) çiftlerini döndürür. Kullanıcı zihin modeli
 * "bu personel bu eğitimi daha önce aldı/atandı" şeklinde — dönem ayrımı
 * UI seviyesinde gösterilmiyor, bu yüzden dönem-bağımsız kontrol ediyoruz.
 */
export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('trainingIds') ?? '';

  const trainingIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (trainingIds.length === 0) {
    return jsonResponse({ assignments: [] });
  }

  // Tenant guard: sadece bu organizasyona ait eğitimler
  const trainings = await prisma.training.findMany({
    where: { id: { in: trainingIds }, organizationId },
    select: { id: true },
  });
  const validIds = trainings.map(t => t.id);
  if (validIds.length === 0) {
    return jsonResponse({ assignments: [] });
  }

  // Tüm dönemlerdeki atamalar — userId bazında dedup
  const existing = await prisma.trainingAssignment.findMany({
    where: {
      trainingId: { in: validIds },
      user: { organizationId },
    },
    select: { trainingId: true, userId: true },
    distinct: ['trainingId', 'userId'],
  });

  return jsonResponse(
    { assignments: existing },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  );
}, { requireOrganization: true });
