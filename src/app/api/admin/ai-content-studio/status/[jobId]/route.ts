// AI İçerik Stüdyosu — İş durumu sorgulama
// GET /api/admin/ai-content-studio/status/[jobId]

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getStatus } from '@/app/admin/ai-content-studio/lib/ai-service-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // DB'den kayıt + organizasyon izolasyonu
  const record = await prisma.aiGeneratedContent.findFirst({
    where: { id: jobId, organizationId: dbUser!.organizationId! },
  })
  if (!record) return errorResponse('İş bulunamadı.', 404)

  // Eğer iş henüz tamamlanmadıysa Python servisinden canlı durum al
  if (record.status === 'queued' || record.status === 'processing') {
    try {
      const pyStatus = await getStatus(jobId)

      // DB'yi güncelle
      if (pyStatus.status !== record.status || pyStatus.progress > 0) {
        await prisma.aiGeneratedContent.update({
          where: { id: jobId },
          data: {
            status: pyStatus.status,
            ...(pyStatus.resultType && { outputFileType: pyStatus.resultType }),
            ...(pyStatus.error && { errorMessage: pyStatus.error, status: 'failed' }),
          },
        })
      }

      return jsonResponse({
        jobId: record.id,
        status: pyStatus.status,
        progress: pyStatus.progress,
        resultType: pyStatus.resultType ?? record.outputFileType,
        error: pyStatus.error ?? record.errorMessage,
        evaluation: record.evaluation,
      })
    } catch {
      // Python servisine ulaşılamıyor veya 404 → timeout kontrolü
      const TIMEOUT_MS = 15 * 60 * 1000 // 15 dakika
      const elapsed = Date.now() - new Date(record.createdAt).getTime()
      if (elapsed > TIMEOUT_MS) {
        await prisma.aiGeneratedContent.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            errorMessage: 'Üretim zaman aşımına uğradı. Lütfen tekrar deneyin.',
          },
        })
        return jsonResponse({
          jobId: record.id,
          status: 'failed',
          progress: 0,
          resultType: null,
          error: 'Üretim zaman aşımına uğradı. Lütfen tekrar deneyin.',
          evaluation: record.evaluation,
        })
      }
      // Henüz timeout olmadı — DB durumunu döndür
    }
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
    jobId: record.id,
    status: record.status,
    progress: record.status === 'completed' ? 100 : 0,
    resultType,
    error: record.errorMessage,
    evaluation: record.evaluation,
    evaluationNote: record.evaluationNote,
    savedToLibrary: record.savedToLibrary,
  })
}
