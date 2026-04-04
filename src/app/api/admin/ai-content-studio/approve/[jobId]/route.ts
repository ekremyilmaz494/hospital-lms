// AI İçerik Stüdyosu — Kütüphaneye ekleme (sadece evaluation === "approved")
// POST /api/admin/ai-content-studio/approve/[jobId]
// KRİTİK: evaluation !== "approved" ise 403 döner.

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse, createAuditLog } from '@/lib/api-helpers'
import { uploadBuffer } from '@/lib/s3'
import { prisma } from '@/lib/prisma'
import { getResult } from '@/app/admin/ai-content-studio/lib/ai-service-client'

const FORMAT_EXT: Record<string, string> = {
  AUDIO_OVERVIEW: 'mp3',
  VIDEO_OVERVIEW: 'mp4',
  STUDY_GUIDE: 'md',
  QUIZ: 'json',
  AUDIO_QUIZ: 'mp3',
  INFOGRAPHIC: 'png',
  FLASHCARDS: 'json',
  SLIDE_DECK: 'pptx',
}

const MAPPED_CONTENT_TYPE: Record<string, string> = {
  AUDIO_OVERVIEW: 'audio/mpeg',
  VIDEO_OVERVIEW: 'video/mp4',
  STUDY_GUIDE: 'text/markdown',
  QUIZ: 'application/json',
  AUDIO_QUIZ: 'audio/mpeg',
  FLASHCARDS: 'application/json',
  INFOGRAPHIC: 'image/png',
  SLIDE_DECK: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Geçersiz istek.')

  const { title, description, category, difficulty, targetRoles, duration } = body
  if (!title || !category || !difficulty || !targetRoles?.length) {
    return errorResponse('title, category, difficulty ve targetRoles zorunludur.')
  }

  // Kayıt + org izolasyonu
  const record = await prisma.aiGeneratedContent.findFirst({
    where: { id: jobId, organizationId: dbUser!.organizationId! },
  })
  if (!record) return errorResponse('İş bulunamadı.', 404)
  if (record.evaluation !== 'approved') {
    return errorResponse('İçerik önce "Beğendim" olarak değerlendirilmelidir.', 403)
  }
  if (record.savedToLibrary) return errorResponse('Bu içerik zaten kütüphaneye eklenmiş.')

  // Python servisinden sonuç dosyasını al
  const { buffer, contentType } = await getResult(jobId)

  // S3'e kalıcı klasöre yükle
  const ext = FORMAT_EXT[record.outputFormat] ?? 'bin'
  const s3Key = `content-library/ai/${dbUser!.organizationId}/${jobId}.${ext}`
  await uploadBuffer(s3Key, buffer, MAPPED_CONTENT_TYPE[record.outputFormat] ?? contentType)

  // ContentLibrary kaydı oluştur
  const mappedCT = MAPPED_CONTENT_TYPE[record.outputFormat] ?? ''
  const contentItem = await prisma.contentLibrary.create({
    data: {
      title,
      description: description ?? '',
      category,
      difficulty,
      targetRoles,
      duration: duration ?? 10,
      thumbnailUrl: mappedCT.includes('image') ? s3Key : undefined,
      isActive: true,
      createdById: dbUser!.id,
    },
  })

  // AiGeneratedContent'i güncelle — kütüphaneye eklendi
  await prisma.aiGeneratedContent.update({
    where: { id: jobId },
    data: {
      savedToLibrary: true,
      libraryName: title,
      libraryCategory: category,
      outputUrl: s3Key,
      outputKey: s3Key,
      savedAt: new Date(),
    },
  })

  await createAuditLog({
    userId: dbUser!.id,
    organizationId: dbUser!.organizationId,
    action: 'ai_content.save_to_library',
    entityType: 'content_library',
    entityId: contentItem.id,
    newData: { jobId, format: record.outputFormat, s3Key },
  })

  return jsonResponse({ contentLibraryId: contentItem.id, s3Key }, 201)
}
