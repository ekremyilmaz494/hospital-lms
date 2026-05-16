import { prisma } from '@/lib/prisma'
import { jsonResponse } from '@/lib/api-helpers'
import { withStaffRoute } from '@/lib/api-handler'

export const GET = withStaffRoute(async ({ dbUser, organizationId }) => {
  const userId = dbUser.id
  const orgId = organizationId

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

  return jsonResponse({ pending, mySubjectEvals }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
}, { requireOrganization: true })
