import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

/** GET /api/admin/accreditation/standards?standardBody=JCI */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { searchParams } = new URL(request.url)
  const standardBody = searchParams.get('standardBody') ?? undefined

  try {
    const standards = await prisma.accreditationStandard.findMany({
      where: {
        isActive: true,
        ...(standardBody ? { standardBody } : {}),
      },
      orderBy: [{ standardBody: 'asc' }, { code: 'asc' }],
    })

    return jsonResponse({ standards })
  } catch {
    return errorResponse('Standartlar getirilemedi', 500)
  }
}
