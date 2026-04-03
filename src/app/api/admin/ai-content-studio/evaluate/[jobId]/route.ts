// AI İçerik Stüdyosu — İçerik değerlendirme (beğen / beğenme)
// PATCH /api/admin/ai-content-studio/evaluate/[jobId]
// KRİTİK: evaluation = "approved" olmadan "Kütüphaneye Ekle" aktif olmaz.

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek.')

  const { evaluation, note } = body
  if (!evaluation || !['approved', 'rejected'].includes(evaluation)) {
    return errorResponse('evaluation "approved" veya "rejected" olmalıdır.')
  }

  // Kayıt + org izolasyonu
  const record = await prisma.aiGeneratedContent.findFirst({
    where: { id: jobId, organizationId: dbUser!.organizationId! },
  })
  if (!record) return errorResponse('İş bulunamadı.', 404)
  if (record.status !== 'completed') return errorResponse('Sadece tamamlanan içerikler değerlendirilebilir.')
  if (record.savedToLibrary) return errorResponse('Bu içerik zaten kütüphaneye eklenmiş.')

  await prisma.aiGeneratedContent.update({
    where: { id: jobId },
    data: {
      evaluation,
      evaluationNote: note ?? null,
      evaluatedAt: new Date(),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: `ai_content.${evaluation}`,
    entityType: 'ai_generated_content',
    entityId: jobId,
    newData: { evaluation, note },
  })

  return jsonResponse({ evaluation, evaluatedAt: new Date().toISOString() })
}
