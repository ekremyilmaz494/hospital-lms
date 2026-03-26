import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  try {
    const [staffCount, trainingCount, departmentCount, completedAssignments] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, role: 'staff' } }),
      prisma.training.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.department.count({ where: { organizationId: orgId } }),
      prisma.trainingAssignment.count({ where: { training: { organizationId: orgId }, status: 'passed' } }),
    ])

    return jsonResponse({ staffCount, trainingCount, departmentCount, completedAssignments })
  } catch (err) {
    console.error('[Dashboard Stats Error]', err)
    return errorResponse('İstatistikler alınamadı', 503)
  }
}
