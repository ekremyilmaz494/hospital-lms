import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  if (!dbUser!.organizationId) return errorResponse('Organizasyon bulunamadı', 403)

  try {
    const assignments = await prisma.trainingAssignment.findMany({
      where: {
        userId: dbUser!.id,
        training: { organizationId: dbUser!.organizationId! },
      },
      include: {
        training: { select: { id: true, title: true, category: true, startDate: true, endDate: true, examDurationMinutes: true } },
      },
      take: 500,
    })

    // Transform to calendar events
    const events = assignments.map(a => ({
      id: a.id,
      title: a.training.title,
      start: a.training.startDate.toISOString(),
      end: a.training.endDate.toISOString(),
      category: a.training.category,
      status: a.status,
      trainingId: a.training.id,
    }))

    return jsonResponse(events)
  } catch (err) {
    logger.error('Staff Calendar', 'Takvim yüklenemedi', err)
    return errorResponse('Takvim yüklenemedi', 503)
  }
}
