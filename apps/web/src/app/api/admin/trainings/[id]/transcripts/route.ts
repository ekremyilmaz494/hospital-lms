import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { resolveTranscriptStatus, type TranscriptStatus } from '@/lib/transcripts'
import { logger } from '@/lib/logger'

/**
 * Eğitimin videolarının transkript durumları — AI soru üretim ekranındaki
 * "Video Transkripti" kaynak seçici bunu poll'lar.
 *
 * Draft (wizard) videolarında TrainingVideo satırı yoktur → draftData.videos'tan
 * okunur ve durum S3 HEAD'leriyle çözülür (lib/transcripts.ts). Published
 * satırlarda önce DB cache'i (transcriptStatus), yoksa S3 fallback.
 */

interface TranscriptEntry {
  videoKey: string
  title: string
  status: TranscriptStatus
  transcriptKey: string | null
  sizeBytes: number | null
}

// Tek eğitimde makul video sayısı üstünü S3 HEAD fırtınasından koru.
const MAX_CANDIDATES = 20

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  // Bağımsız sorgular: training (draftData + 404 için) ve video satırları
  // (nested org guard'lı) paralel çekilir.
  const [training, rows] = await Promise.all([
    prisma.training.findFirst({
      where: { id, organizationId },
      select: { id: true, draftData: true },
    }),
    prisma.trainingVideo.findMany({
      where: {
        trainingId: id,
        contentType: 'video',
        training: { organizationId },
      },
      select: { title: true, videoKey: true, transcriptKey: true, transcriptStatus: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])
  if (!training) return errorResponse('Eğitim bulunamadı', 404)

  type Candidate = {
    videoKey: string
    title: string
    dbStatus: string | null
    dbKey: string | null
  }
  const candidates: Candidate[] = rows.map((v) => ({
    videoKey: v.videoKey,
    title: v.title,
    dbStatus: v.transcriptStatus,
    dbKey: v.transcriptKey,
  }))

  // Draft videoları (satırı henüz olmayanlar) — draftData free-form JSON, defensive cast.
  const dd = training.draftData as {
    videos?: Array<{ title?: string; url?: string; contentType?: string }>
  } | null
  if (dd?.videos && Array.isArray(dd.videos)) {
    const known = new Set(candidates.map((c) => c.videoKey))
    for (const v of dd.videos) {
      if (!v.url || (v.contentType ?? 'video') !== 'video' || known.has(v.url)) continue
      candidates.push({ videoKey: v.url, title: v.title || 'Video', dbStatus: null, dbKey: null })
    }
  }

  const limited = candidates.slice(0, MAX_CANDIDATES)

  let entries: TranscriptEntry[]
  try {
    entries = await Promise.all(
      limited.map(async (c): Promise<TranscriptEntry> => {
        // DB cache'i terminal durumu biliyorsa S3 HEAD'e gerek yok.
        if (c.dbStatus === 'completed' && c.dbKey) {
          return {
            videoKey: c.videoKey,
            title: c.title,
            status: 'completed',
            transcriptKey: c.dbKey,
            sizeBytes: null,
          }
        }
        if (c.dbStatus === 'failed') {
          return {
            videoKey: c.videoKey,
            title: c.title,
            status: 'failed',
            transcriptKey: null,
            sizeBytes: null,
          }
        }
        const resolved = await resolveTranscriptStatus(c.videoKey)
        return { videoKey: c.videoKey, title: c.title, ...resolved }
      }),
    )
  } catch (err) {
    logger.error('Transcripts:GET', 'Transkript durumu çözülemedi', { trainingId: id, error: err })
    return errorResponse('Transkript durumu alınamadı', 500)
  }

  // Kısa cache: durum "Hazırlanıyor → Hazır" geçişini UI poll'u yakalasın.
  return jsonResponse(
    { transcripts: entries },
    200,
    { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  )
}, { requireOrganization: true })
