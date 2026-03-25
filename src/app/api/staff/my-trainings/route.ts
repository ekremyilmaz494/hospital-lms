import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // assigned | in_progress | passed | failed

  const where: Record<string, unknown> = { userId: dbUser!.id }
  if (status) where.status = status

  const assignments = await prisma.trainingAssignment.findMany({
    where,
    include: {
      training: {
        include: {
          videos: { select: { id: true, title: true, durationSeconds: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
          _count: { select: { questions: true, videos: true } },
        },
      },
      examAttempts: { orderBy: { attemptNumber: 'desc' } },
    },
    orderBy: { assignedAt: 'desc' },
  })

  return jsonResponse(assignments)
}
