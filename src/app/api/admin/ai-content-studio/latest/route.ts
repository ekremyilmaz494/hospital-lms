import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

const RESULT_TYPE_MAP: Record<string, string> = {
  mp3: 'audio', mp4: 'video',
  pdf: 'presentation', pptx: 'presentation',
  json: 'json', png: 'image',
  csv: 'data', md: 'document',
}

export async function GET() {
  try {
    const { dbUser, error } = await getAuthUser()
    if (error) return error
    const roleError = requireRole(dbUser!.role, ['admin'])
    if (roleError) return roleError
    const orgId = dbUser!.organizationId!

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const latest = await prisma.aiGeneration.findFirst({
      where: {
        organizationId: orgId,
        status: { in: ['queued', 'processing', 'downloading', 'completed'] },
        savedToLibrary: false,
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
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
      },
    })

    if (!latest) return new Response(null, { status: 204 })

    return jsonResponse({
      jobId: latest.id,
      title: latest.title,
      artifactType: latest.artifactType,
      status: latest.status,
      progress: latest.progress,
      resultType: latest.outputFileType ? RESULT_TYPE_MAP[latest.outputFileType] || null : null,
      evaluation: latest.evaluation,
      savedToLibrary: latest.savedToLibrary,
      error: latest.errorMessage,
      createdAt: latest.createdAt,
    })
  } catch (e) {
    return errorResponse('Son içerik bilgisi alınırken bir hata oluştu', 500)
  }
}
