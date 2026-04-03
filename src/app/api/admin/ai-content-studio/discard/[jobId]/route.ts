// AI İçerik Stüdyosu — İçerik silme
// DELETE /api/admin/ai-content-studio/discard/[jobId]

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { deleteObject } from '@/lib/s3'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // Kayıt + org izolasyonu
  const record = await prisma.aiGeneratedContent.findFirst({
    where: { id: jobId, organizationId: dbUser!.organizationId! },
  })
  if (!record) return errorResponse('İş bulunamadı.', 404)
  if (record.savedToLibrary) return errorResponse('Kütüphaneye eklenmiş içerik silinemez.')

  // S3'teki dosyayı sil (varsa)
  if (record.outputKey) {
    try { await deleteObject(record.outputKey) } catch { /* best-effort */ }
  }

  // Python servisteki geçici dosyayı temizle (best-effort)
  try {
    const AI_SERVICE_URL = process.env.AI_CONTENT_SERVICE_URL ?? 'http://localhost:8100'
    await fetch(`${AI_SERVICE_URL}/api/result/${jobId}`, {
      method: 'DELETE',
      headers: { 'X-Internal-Key': process.env.AI_CONTENT_INTERNAL_KEY ?? '' },
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* Temizleme başarısız olsa da devam et */ }

  // İlişkili dokümanları bağlantısını kes, sonra kaydı sil
  await prisma.aiGeneratedContent.update({
    where: { id: jobId },
    data: { documents: { set: [] } },
  })
  await prisma.aiGeneratedContent.delete({ where: { id: jobId } })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'ai_content.discard',
    entityType: 'ai_generated_content',
    entityId: jobId,
  })

  return jsonResponse({ discarded: true })
}
