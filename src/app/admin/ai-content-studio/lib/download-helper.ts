/**
 * Download & Save — NotebookLM artifact'ını indirip S3'e kaydeder.
 * generate (mind_map) ve status (completed) endpoint'lerinden çağrılır.
 */

import { prisma } from '@/lib/prisma'
import { uploadBuffer } from '@/lib/s3'
import { logger } from '@/lib/logger'
import { downloadArtifact } from './ai-service-client'

/** Artifact type → varsayılan output format. */
const OUTPUT_FORMAT_MAP: Record<string, string | undefined> = {
  audio: undefined,
  video: undefined,
  slide_deck: 'pdf',
  quiz: 'json',
  flashcards: 'json',
  report: undefined,
  infographic: undefined,
  data_table: 'csv',
  mind_map: 'json',
}

/** Artifact type → dosya uzantısı. */
const EXTENSION_MAP: Record<string, string> = {
  audio: 'mp3',
  video: 'mp4',
  slide_deck: 'pdf',
  quiz: 'json',
  flashcards: 'json',
  report: 'md',
  infographic: 'png',
  data_table: 'csv',
  mind_map: 'json',
}

/** Artifact type → outputFileType DB alanı. */
const FILE_TYPE_MAP: Record<string, string> = {
  audio: 'mp3',
  video: 'mp4',
  slide_deck: 'pdf',
  quiz: 'json',
  flashcards: 'json',
  report: 'md',
  infographic: 'png',
  data_table: 'csv',
  mind_map: 'json',
}

/** JSON parse gerektiren artifact tipleri. */
const JSON_CONTENT_TYPES = new Set(['quiz', 'flashcards', 'mind_map', 'data_table'])

interface DownloadParams {
  generationId: string
  notebookLmId: string
  artifactLmId: string
  artifactType: string
  organizationId: string
  settings?: Record<string, string>
}

/**
 * Artifact'ı NotebookLM'den indirip S3'e yükler ve DB'yi günceller.
 * Hata durumunda generation status'unu "failed" yapar.
 */
export async function downloadAndSaveArtifact(params: DownloadParams): Promise<void> {
  const { generationId, notebookLmId, artifactLmId, artifactType, organizationId, settings } = params

  try {
    // Status: downloading
    await prisma.aiGeneration.update({
      where: { id: generationId },
      data: { status: 'downloading', progress: 90 },
    })

    // slide_deck özel: settings.format pptx ise pptx indir
    let outputFormat = OUTPUT_FORMAT_MAP[artifactType]
    let ext = EXTENSION_MAP[artifactType] || 'bin'
    let fileType = FILE_TYPE_MAP[artifactType] || ext

    if (artifactType === 'slide_deck' && settings?.format === 'pptx') {
      outputFormat = 'pptx'
      ext = 'pptx'
      fileType = 'pptx'
    }

    // Download from sidecar
    const buffer = await downloadArtifact(notebookLmId, artifactLmId, artifactType, outputFormat, organizationId)

    // S3 upload
    const s3Key = `ai-studio/outputs/${organizationId}/${generationId}.${ext}`
    const contentTypeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      json: 'application/json',
      md: 'text/markdown',
      png: 'image/png',
      csv: 'text/csv',
    }
    await uploadBuffer(s3Key, buffer, contentTypeMap[ext] || 'application/octet-stream')

    // JSON content parse (quiz, flashcards, mind_map, data_table)
    let contentData: unknown = null
    if (JSON_CONTENT_TYPES.has(artifactType)) {
      try {
        contentData = JSON.parse(buffer.toString('utf-8'))
      } catch {
        logger.error('AI Download', `JSON parse hatası: ${artifactType}`, null)
      }
    }

    // DB update: completed
    await prisma.aiGeneration.update({
      where: { id: generationId },
      data: {
        status: 'completed',
        progress: 100,
        outputS3Key: s3Key,
        outputFileType: fileType,
        outputSize: buffer.length,
        ...(contentData ? { contentData } : {}),
      },
    })
  } catch (err) {
    logger.error('AI Download', `Artifact indirme hatası (${generationId})`, err)
    await prisma.aiGeneration.update({
      where: { id: generationId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'İndirme hatası',
      },
    }).catch(() => {})
  }
}
