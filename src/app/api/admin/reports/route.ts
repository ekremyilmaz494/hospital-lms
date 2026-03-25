import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') ?? 'overview'

  if (tab === 'overview') {
    const [staffCount, trainingCount, assignmentStats, avgScore] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff', isActive: true } }),
      prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.trainingAssignment.groupBy({
        by: ['status'],
        where: { training: { organizationId: orgId } },
        _count: true,
      }),
      prisma.examAttempt.aggregate({
        where: { training: { organizationId: orgId }, postExamScore: { not: null } },
        _avg: { postExamScore: true },
      }),
    ])

    return jsonResponse({
      staffCount,
      trainingCount,
      assignmentStats: Object.fromEntries(assignmentStats.map(s => [s.status, s._count])),
      avgScore: avgScore._avg.postExamScore ? Number(avgScore._avg.postExamScore) : 0,
    })
  }

  if (tab === 'trainings') {
    const trainings = await prisma.training.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { assignments: true } },
        assignments: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonResponse(trainings.map(t => ({
      ...t,
      completionRate: t.assignments.length > 0
        ? Math.round((t.assignments.filter(a => a.status === 'passed').length / t.assignments.length) * 100)
        : 0,
      assignments: undefined,
    })))
  }

  if (tab === 'staff') {
    const staff = await prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' },
      include: {
        assignments: { include: { examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } } },
      },
    })

    return jsonResponse(staff.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      department: s.department,
      totalAssignments: s.assignments.length,
      completed: s.assignments.filter(a => a.status === 'passed').length,
      failed: s.assignments.filter(a => a.status === 'failed').length,
      inProgress: s.assignments.filter(a => ['assigned', 'in_progress'].includes(a.status)).length,
    })))
  }

  if (tab === 'exams') {
    const attempts = await prisma.examAttempt.findMany({
      where: { training: { organizationId: orgId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        training: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return jsonResponse(attempts)
  }

  return jsonResponse([])
}
