/**
 * GET /api/admin/ai-content-studio — generation history list (paginated).
 */
import { prisma } from '@/lib/prisma'
import { jsonResponse, safePagination } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { AI_GEN_STATUSES, AI_ARTIFACT_TYPES } from '@/lib/ai-content-studio/constants'

export const GET = withAdminRoute(async ({ request, organizationId }) => {
  const url = new URL(request.url)
  const { page, limit, skip } = safePagination(url.searchParams, 50)
  const statusParam = url.searchParams.get('status')
  const typeParam = url.searchParams.get('type')

  const status = statusParam && (AI_GEN_STATUSES as readonly string[]).includes(statusParam)
    ? statusParam : undefined
  const artifactType = typeParam && (AI_ARTIFACT_TYPES as readonly string[]).includes(typeParam)
    ? typeParam : undefined

  const where = {
    organizationId,
    ...(status ? { status } : {}),
    ...(artifactType ? { artifactType } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.aiGeneration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      select: {
        id: true,
        artifactType: true,
        status: true,
        prompt: true,
        fileSize: true,
        mimeType: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.aiGeneration.count({ where }),
  ])

  return jsonResponse(
    { items, total, page, limit },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })
