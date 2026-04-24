import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

/**
 * GET /api/admin/content-library/ai-items
 *
 * Kütüphanedeki AI-üretimi içerikleri listeler.
 * Query params:
 *   type   — virgülle ayrılmış contentType (video,audio,pdf,quiz)
 *   search — title'da arama
 */
export async function GET(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId!
  const { searchParams } = new URL(request.url)

  const typeParam = searchParams.get('type')
  const search = searchParams.get('search')

  const types = typeParam ? typeParam.split(',').map(t => t.trim()).filter(Boolean) : []

  const where: Record<string, unknown> = {
    isActive: true,
    organizationId: orgId,
    s3Key: { not: null },
  }

  if (types.length > 0) {
    where.contentType = { in: types }
  }

  if (search) {
    where.title = { contains: search, mode: 'insensitive' }
  }

  const items = await prisma.contentLibrary.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      contentType: true,
      s3Key: true,
      fileType: true,
      duration: true,
      difficulty: true,
      thumbnailUrl: true,
      contentData: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return jsonResponse({ items })
}
