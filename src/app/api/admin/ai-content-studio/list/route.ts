import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, safePagination } from '@/lib/api-helpers'

const RESULT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio', mp4: 'video',
  pdf: 'presentation', pptx: 'presentation',
  json: 'json', png: 'image',
  csv: 'data', md: 'document',
}

export async function GET(request: Request) {
  try {
    const { dbUser, error } = await getAuthUser()
    if (error) return error
    const roleError = requireRole(dbUser!.role, ['admin'])
    if (roleError) return roleError
    const orgId = dbUser!.organizationId!

    const { searchParams } = new URL(request.url)
    const { page, limit, search, skip } = safePagination(searchParams)

    const where: Record<string, unknown> = {
      organizationId: orgId,
    }

    const statusParam = searchParams.get('status') || 'all'
    if (statusParam === 'generating') {
      where.status = { in: ['queued', 'processing', 'downloading'] }
    } else if (statusParam === 'completed') {
      where.status = 'completed'
    } else if (statusParam === 'failed') {
      where.status = 'failed'
    } else if (statusParam === 'saved') {
      where.savedToLibrary = true
    }

    const artifactTypeParam = searchParams.get('artifactType')
    if (artifactTypeParam) {
      where.artifactType = artifactTypeParam
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' }
    }

    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const validSortFields = ['createdAt', 'title', 'artifactType']
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const orderBy = { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' }

    const [items, total] = await Promise.all([
      prisma.aiGeneration.findMany({
        where,
        select: {
          id: true,
          title: true,
          artifactType: true,
          status: true,
          progress: true,
          outputFileType: true,
          evaluation: true,
          savedToLibrary: true,
          errorMessage: true,
          createdAt: true,
          evaluatedAt: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.aiGeneration.count({ where }),
    ])

    const mapped = items.map(item => ({
      id: item.id,
      title: item.title,
      artifactType: item.artifactType,
      status: item.status,
      progress: item.progress,
      resultType: item.outputFileType ? RESULT_TYPE_MAP[item.outputFileType] || null : null,
      evaluation: item.evaluation,
      savedToLibrary: item.savedToLibrary,
      error: item.errorMessage,
      createdAt: item.createdAt,
      evaluatedAt: item.evaluatedAt,
    }))

    return jsonResponse({
      items: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (e) {
    return errorResponse('İçerik listesi alınırken bir hata oluştu', 500)
  }
}
