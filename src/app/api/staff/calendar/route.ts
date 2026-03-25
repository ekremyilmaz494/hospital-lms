import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  const assignments = await prisma.trainingAssignment.findMany({
    where: { userId: dbUser!.id },
    include: {
      training: { select: { id: true, title: true, category: true, startDate: true, endDate: true, examDurationMinutes: true } },
    },
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
}
