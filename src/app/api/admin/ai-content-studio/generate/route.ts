// AI İçerik Stüdyosu — İçerik üretimi başlatma
// POST /api/admin/ai-content-studio/generate
// Google bağlantısı kontrolü + cookie decrypt + Python servise gönderim

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { decrypt } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { startGeneration } from '@/app/admin/ai-content-studio/lib/ai-service-client'

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Google bağlantısı kontrolü
  const connection = await prisma.aiGoogleConnection.findUnique({
    where: { organizationId: dbUser!.organizationId! },
  })
  if (!connection || connection.status !== 'connected') {
    return errorResponse('Google hesabınızı bağlayın. Ayarlar → Google Hesap Bağlantısı', 403)
  }

  // Saatte 10 üretim / organizasyon
  const ok = await checkRateLimit(`ai-generate:${dbUser!.organizationId}`, 10, 3600)
  if (!ok) return errorResponse('Saatlik üretim limiti (10) aşıldı.', 429)

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek.')

  const { format, audioFormat, videoStyle, documentText, documentTitle, customInstructions, documentIds, settings } = body

  if (!format || !documentText || !documentTitle) {
    return errorResponse('format, documentText ve documentTitle zorunludur.')
  }

  // Cookie'yi decrypt et (varsa)
  let cookieData: string | undefined
  if (connection.encryptedCookie) {
    try {
      cookieData = decrypt(connection.encryptedCookie)
    } catch {
      return errorResponse('Saklanan cookie çözülemedi. Lütfen Google hesabınızı yeniden bağlayın.', 403)
    }
  }

  // DB'ye AiGeneratedContent kaydı oluştur
  const record = await prisma.aiGeneratedContent.create({
    data: {
      organizationId: dbUser!.organizationId!,
      userId: dbUser!.id,
      title: documentTitle,
      prompt: customInstructions ?? '',
      outputFormat: format,
      settings: settings ?? { audioFormat, videoStyle, ...(body.duration && { duration: body.duration }), ...(body.tone && { tone: body.tone }), ...(body.audience && { audience: body.audience }), ...(body.language && { language: body.language }) },
      status: 'queued',
      documents: documentIds?.length
        ? { connect: documentIds.map((id: string) => ({ id })) }
        : undefined,
    },
  })

  // Python servisine iş başlat
  try {
    await startGeneration({
      jobId: record.id,
      format,
      audioFormat,
      videoStyle,
      documentText,
      documentTitle,
      customInstructions,
    })
  } catch (err) {
    await prisma.aiGeneratedContent.update({
      where: { id: record.id },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'Python servisine ulaşılamadı.' },
    })
    return errorResponse('Üretim servisi şu an kullanılamıyor.', 503)
  }

  // lastUsedAt güncelle
  await prisma.aiGoogleConnection.update({
    where: { organizationId: dbUser!.organizationId! },
    data: { lastUsedAt: new Date() },
  })

  return jsonResponse({ jobId: record.id, status: 'queued' }, 202)
}
