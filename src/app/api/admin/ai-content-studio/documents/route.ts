// AI İçerik Stüdyosu — Belge yükleme
// POST /api/admin/ai-content-studio/documents

import { NextRequest } from 'next/server'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { uploadBuffer } from '@/lib/s3'
import { prisma } from '@/lib/prisma'
import { analyzeDocument } from '@/app/admin/ai-content-studio/lib/ai-service-client'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/octet-stream', // Bazı tarayıcılarda .md dosyaları
  '',                         // Bazı tarayıcılarda MIME type boş gelir
]

// Dosya uzantısına göre de kabul et (MIME type güvenilmez olabilir)
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt', '.md']

function isAllowedFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  return ALLOWED_EXTENSIONS.includes(ext)
}

export async function POST(request: NextRequest) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error
  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const ok = await checkRateLimit(`ai-doc-upload:${dbUser!.organizationId}`, 20, 3600)
  if (!ok) return errorResponse('Saatte 20 belgeden fazla yüklenemez.', 429)

  const formData = await request.formData().catch(() => null)
  if (!formData) return errorResponse('Geçersiz form verisi.')

  const file = formData.get('file') as File | null
  if (!file) return errorResponse('Dosya bulunamadı.')
  if (!isAllowedFile(file)) return errorResponse(`Desteklenmeyen dosya türü: ${file.type || 'bilinmiyor'} (${file.name})`)
  if (file.size > MAX_FILE_SIZE) return errorResponse('Dosya 20MB\'ı geçemez.')

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'bin'
    const s3Key = `ai-studio/docs/${dbUser!.organizationId}/${crypto.randomUUID()}.${ext}`

    // S3'e yükle
    await uploadBuffer(s3Key, buffer, file.type)

    // DB'ye AiDocument kaydı oluştur
    const doc = await prisma.aiDocument.create({
      data: {
        organizationId: dbUser!.organizationId!,
        userId: dbUser!.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: s3Key,
        fileKey: s3Key,
      },
    })

    // Belge analizi (opsiyonel — hata olsa da devam et)
    let summary: string | undefined
    let keyTopics: string[] = []
    try {
      const text = buffer.toString('utf-8').slice(0, 10_000)
      const analysis = await analyzeDocument(text, file.name)
      summary = analysis.summary
      keyTopics = analysis.keyTopics
    } catch { /* Analiz opsiyonel */ }

    return jsonResponse({
      id: doc.id,
      name: file.name,
      size: file.size,
      type: file.type,
      s3Key,
      s3Url: s3Key,
      summary,
      keyTopics,
      uploadedAt: doc.createdAt.toISOString(),
    }, 201)
  } catch (err) {
    console.error('[AI-Studio] Document upload error:', err)
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return errorResponse(`Yükleme hatası: ${message}`, 500)
  }
}
