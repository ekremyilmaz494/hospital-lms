import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/competency-matrix
 * Personel × Eğitim matrisi — kim hangi eğitimde hangi durumda?
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!

  const allowed = await checkRateLimit(`competency:${orgId}`, 5, 60)
  if (!allowed) return errorResponse('Çok fazla istek. Lütfen bekleyin.', 429)

  try {
    const [staff, trainings] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, role: 'staff', isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: true,
          departmentRel: { select: { name: true, color: true } },
          assignments: {
            select: {
              trainingId: true,
              status: true,
              completedAt: true,
              examAttempts: {
                orderBy: { attemptNumber: 'desc' },
                take: 1,
                select: { postExamScore: true, isPassed: true },
              },
            },
          },
          certificates: {
            select: { trainingId: true, issuedAt: true, expiresAt: true },
          },
        },
        orderBy: [{ department: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.training.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, title: true, category: true, isCompulsory: true, passingScore: true },
        orderBy: [{ isCompulsory: 'desc' }, { category: 'asc' }, { title: 'asc' }],
      }),
    ])

    // Matris oluştur: her personel için her eğitimin durumu
    const matrix = staff.map(s => {
      const assignmentMap = new Map(s.assignments.map(a => [a.trainingId, a]))
      const certMap = new Map(s.certificates.map(c => [c.trainingId, c]))

      const cells = trainings.map(t => {
        const assignment = assignmentMap.get(t.id)
        const cert = certMap.get(t.id)

        if (!assignment) {
          return { trainingId: t.id, state: 'unassigned' as const }
        }

        const score = assignment.examAttempts[0]?.postExamScore
          ? Number(assignment.examAttempts[0].postExamScore)
          : null

        let certStatus: 'valid' | 'expiring' | 'expired' | null = null
        if (cert?.expiresAt) {
          const daysLeft = Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / 86400000)
          certStatus = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring' : 'valid'
        } else if (cert) {
          certStatus = 'valid'
        }

        return {
          trainingId: t.id,
          state: assignment.status as string,
          score,
          completedAt: assignment.completedAt?.toISOString() ?? null,
          certStatus,
          certExpiresAt: cert?.expiresAt?.toISOString() ?? null,
        }
      })

      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        title: s.title,
        department: s.departmentRel?.name ?? s.department ?? '',
        departmentColor: s.departmentRel?.color ?? '#0d9668',
        cells,
        // Özet istatistikler
        totalAssigned: s.assignments.length,
        totalPassed: s.assignments.filter(a => a.status === 'passed').length,
        completionRate: s.assignments.length > 0
          ? Math.round((s.assignments.filter(a => a.status === 'passed').length / s.assignments.length) * 100)
          : 0,
      }
    })

    return jsonResponse({
      trainings: trainings.map(t => ({ id: t.id, title: t.title, category: t.category, isCompulsory: t.isCompulsory })),
      staff: matrix,
      summary: {
        totalStaff: staff.length,
        totalTrainings: trainings.length,
        compulsoryTrainings: trainings.filter(t => t.isCompulsory).length,
      },
    })
  } catch (err) {
    logger.error('CompetencyMatrix', 'Matris verileri alınamadı', err)
    return errorResponse('Yetkinlik matrisi alınamadı', 503)
  }
}
