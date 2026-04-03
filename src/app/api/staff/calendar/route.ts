import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  // B8.3/G8.3 — ?month=YYYY-MM filtresi: o aya ait veya o ayı kapsayan eğitimleri döndür
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month') // örn. "2026-03"
  let dateFilter: { startDate?: { lte: Date }; endDate?: { gte: Date } } | undefined

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split('-').map(Number)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999) // ayın son günü
    // Eğitim süresi ay ile kesişiyor mu? startDate <= ayBiti && endDate >= ayBaslangici
    dateFilter = { startDate: { lte: monthEnd }, endDate: { gte: monthStart } }
  }

  try {
    const { page, limit } = safePagination(searchParams)

    const where = {
      userId: dbUser!.id,
      training: {
        organizationId: dbUser!.organizationId!,
        ...(dateFilter ?? {}),
      },
    }

    const [assignments, total] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where,
        include: {
          training: { select: { id: true, title: true, category: true, startDate: true, endDate: true, examDurationMinutes: true, examOnly: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trainingAssignment.count({ where }),
    ])

    // Transform to calendar events
    const events = assignments.map(a => ({
      id: a.id,
      title: a.training.title,
      start: a.training.startDate.toISOString(),
      end: a.training.endDate.toISOString(),
      category: a.training.category,
      status: a.status,
      trainingId: a.training.id,
      eventType: a.training.examOnly ? 'exam' as const : 'training' as const,
    }))

    return jsonResponse({ events, total, page, limit })
  } catch (err) {
    logger.error('Staff Calendar', 'Takvim yüklenemedi', err)
    return errorResponse('Takvim yüklenemedi', 503)
  }
}
