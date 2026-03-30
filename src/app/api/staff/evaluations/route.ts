import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['staff', 'admin'])
  if (roleError) return roleError

  const userId = dbUser!.id
  const orgId = dbUser!.organizationId!

  const [pending, mySubjectEvals] = await Promise.all([
    // Bekleyen: ben başkasını değerlendireceğim
    prisma.competencyEvaluation.findMany({
      where: {
        evaluatorId: userId,
        status: 'PENDING',
        form: { organizationId: orgId, isActive: true },
      },
      include: {
        form: { select: { id: true, title: true, periodEnd: true } },
        subject: { select: { firstName: true, lastName: true, departmentRel: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Hakkımdaki tamamlanmış değerlendirmeler
    prisma.competencyEvaluation.findMany({
      where: {
        subjectId: userId,
        form: { organizationId: orgId },
      },
      include: {
        form: { select: { id: true, title: true, periodEnd: true } },
        _count: { select: { answers: true } },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['formId'],
    }),
  ])

  return jsonResponse({ pending, mySubjectEvals })
}
