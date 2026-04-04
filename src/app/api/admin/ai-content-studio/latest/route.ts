// AI İçerik Stüdyosu — En son aktif job'u döndür
// GET /api/admin/ai-content-studio/latest

import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // En son queued/processing/completed job'u bul (son 24 saat)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const record = await prisma.aiGeneratedContent.findFirst({
    where: {
      organizationId: dbUser!.organizationId!,
      createdAt: { gte: cutoff },
      status: { in: ['queued', 'processing', 'completed'] },
      savedToLibrary: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return jsonResponse({ job: null })
  }

  // outputFileType → resultType mapping
  const fileTypeMap: Record<string, string> = {
    mp3: 'audio', mp4: 'video', json: 'json',
    png: 'image', svg: 'image',
    pptx: 'presentation',
    md: 'document', txt: 'text',
  }
  const resultType = record.outputFileType
    ? (fileTypeMap[record.outputFileType] ?? record.outputFileType)
    : null

  return jsonResponse({
    job: {
      id: record.id,
      title: record.title,
      format: record.outputFormat,
      status: record.status,
      progress: record.status === 'completed' ? 100 : 0,
      resultType,
      error: record.errorMessage,
      evaluation: record.evaluation,
      evaluationNote: record.evaluationNote,
      savedToLibrary: record.savedToLibrary,
      createdAt: record.createdAt.toISOString(),
    },
  })
}
