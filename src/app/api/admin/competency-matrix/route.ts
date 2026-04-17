import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit, withCache } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/competency-matrix
 * Personel × Eğitim matrisi — kim hangi eğitimde hangi durumda?
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`competency:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? 50)))
  const search = searchParams.get('search') ?? ''
  const departmentId = searchParams.get('departmentId')
  const skip = (page - 1) * limit

  const staffWhere: Record<string, unknown> = { organizationId: orgId, role: 'staff', isActive: true }
  if (departmentId) staffWhere.departmentId = departmentId
  if (search) {
    staffWhere.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
    ]
  }

  const cacheKey = `cache:${orgId}:competency:${page}:${limit}:${search}:${departmentId || ''}`

  try {
    const result = await withCache(cacheKey, 300, async () => {
    const [staff, totalStaffCount, trainings, allDepartments] = await Promise.all([
      prisma.user.findMany({
        where: staffWhere,
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          departmentRel: { select: { id: true, name: true } },
          assignments: {
            where: { training: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } } },
            select: {
              trainingId: true,
              status: true,
              examAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
                select: { postExamScore: true },
              },
            },
          },
        },
        orderBy: [{ lastName: 'asc' }],
      }),
      prisma.user.count({ where: staffWhere }),
      prisma.training.findMany({
        where: { organizationId: orgId, isActive: true, publishStatus: { not: 'archived' } },
        select: { id: true, title: true, isCompulsory: true },
        orderBy: [{ isCompulsory: 'desc' }, { title: 'asc' }],
      }),
      prisma.department.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    // Matris oluştur: her personel için her eğitimin durumu
    const matrix = staff.map(s => {
      const assignmentMap = new Map(s.assignments.map(a => [a.trainingId, a]))

      const cells = trainings.map(t => {
        const assignment = assignmentMap.get(t.id)
        if (!assignment) {
          return { trainingId: t.id, state: 'unassigned' as const, score: null }
        }
        const score = assignment.examAttempts[0]?.postExamScore
          ? Number(assignment.examAttempts[0].postExamScore)
          : null
        return {
          trainingId: t.id,
          state: assignment.status as string,
          score,
        }
      })

      const passedCount = s.assignments.filter(a => a.status === 'passed').length
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        department: s.departmentRel?.name ?? '',
        cells,
        completionRate: s.assignments.length > 0
          ? Math.round((passedCount / s.assignments.length) * 100)
          : 0,
      }
    })

    return {
      trainings: trainings.map(t => ({ id: t.id, title: t.title, isCompulsory: t.isCompulsory })),
      staff: matrix,
      departments: allDepartments,
      summary: {
        totalStaff: totalStaffCount,
        totalTrainings: trainings.length,
        compulsoryTrainings: trainings.filter(t => t.isCompulsory).length,
      },
      page,
      limit,
      totalPages: Math.ceil(totalStaffCount / limit),
    }
    })

    return jsonResponse(result, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
  } catch (err) {
    logger.error('CompetencyMatrix', 'Matris verileri alınamadı', err)
    return errorResponse('Yetkinlik matrisi alınamadı', 503)
  }
}
