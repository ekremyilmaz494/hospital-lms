// AI İçerik Stüdyosu — Üretilen içerik sonucunu döndür
// GET /api/admin/ai-content-studio/result/[jobId]
// Python servisinden dosyayı alır ve doğrudan client'a stream eder

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
const INTERNAL_KEY = process.env.AI_CONTENT_INTERNAL_KEY ?? ''

const FORMAT_CONTENT_TYPE: Record<string, string> = {
  AUDIO_OVERVIEW: 'audio/mpeg',
  VIDEO_OVERVIEW: 'video/mp4',
  STUDY_GUIDE: 'text/markdown',
  QUIZ: 'application/json',
  AUDIO_QUIZ: 'audio/mpeg',
  FLASHCARDS: 'application/json',
  INFOGRAPHIC: 'image/png',
  SLIDE_DECK: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // DB'den kayıt + org izolasyonu
  const record = await prisma.aiGeneratedContent.findFirst({
    where: { id: jobId, organizationId: dbUser!.organizationId! },
  })
  if (!record) return errorResponse('İş bulunamadı.', 404)
  if (record.status !== 'completed') return errorResponse('İş henüz tamamlanmadı.', 425)

  // ?meta=true ise sadece URL döndür (frontend polling için)
  if (req.nextUrl.searchParams.get('meta') === 'true') {
    return jsonResponse({
      url: `/api/admin/ai-content-studio/result/${jobId}`,
      format: record.outputFormat,
      contentType: FORMAT_CONTENT_TYPE[record.outputFormat] ?? 'application/octet-stream',
    })
  }

  // Python servisinden dosyayı al ve doğrudan stream et
  try {
    const pyRes = await fetch(`${AI_SERVICE_URL}/api/result/${jobId}`, {
      headers: { 'X-Internal-Key': INTERNAL_KEY },
      signal: AbortSignal.timeout(30_000),
    })

    if (!pyRes.ok) {
      const body = await pyRes.json().catch(() => ({}))
      return errorResponse(body.detail ?? 'Sonuç dosyası alınamadı.', pyRes.status)
    }

    const fullBuffer = Buffer.from(await pyRes.arrayBuffer())
    const contentType = FORMAT_CONTENT_TYPE[record.outputFormat] ?? pyRes.headers.get('content-type') ?? 'application/octet-stream'
    const totalSize = fullBuffer.length

    // Range header desteği — audio/video ileri sarma için gerekli
    const rangeHeader = req.headers.get('range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : totalSize - 1
        const chunk = fullBuffer.subarray(start, end + 1)

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(chunk.length),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=3600',
          },
        })
      }
    }

    return new NextResponse(fullBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[AI-Studio] Result fetch error:', err)
    return errorResponse('Sonuç dosyası alınamadı.', 500)
  }
}
