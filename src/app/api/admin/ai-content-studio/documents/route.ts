import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/redis'
import { uploadBuffer } from '@/lib/s3'
import { createNotebook, addFileSource, addSource, AiServiceError } from '@/app/admin/ai-content-studio/lib/ai-service-client'
import { aiSourceAddSchema } from '@/lib/validations'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
]
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt', '.md']
const MAX_FILE_SIZE = 20 * 1024 * 1024

async function getOrCreateNotebook(
  orgId: string,
  notebookId?: string,
  title?: string,
): Promise<{ notebook: { id: string; notebookLmId: string }; notebookId: string }> {
  if (notebookId) {
    const existing = await prisma.aiNotebook.findFirst({
      where: { id: notebookId, organizationId: orgId },
      select: { id: true, notebookLmId: true },
    })
    if (!existing) throw new Error('Notebook bulunamadı')
    return { notebook: existing, notebookId: existing.id }
  }

  const nbTitle = title || `AI İçerik - ${new Date().toLocaleDateString('tr-TR')}`
  const sidecarNb = await createNotebook(nbTitle, orgId)
  const notebook = await prisma.aiNotebook.create({
    data: {
      organizationId: orgId,
      notebookLmId: sidecarNb.id,
      title: sidecarNb.title,
    },
    select: { id: true, notebookLmId: true },
  })
  return { notebook, notebookId: notebook.id }
}

export async function POST(request: Request) {
  try {
    const { dbUser, error } = await getAuthUser()
    if (error) return error

    const roleError = requireRole(dbUser!.role, ['admin'])
    if (roleError) return roleError

    const orgId = dbUser!.organizationId!

    const allowed = await checkRateLimit(`ai-doc:${orgId}`, 20, 3600)
    if (!allowed) return errorResponse('Çok fazla belge yükleme isteği. Lütfen bir saat sonra tekrar deneyin.', 429)

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) return errorResponse('Dosya seçilmedi', 400)

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return errorResponse('Desteklenmeyen dosya türü. Sadece PDF, DOCX, PPTX, TXT ve MD kabul edilir.', 400)
      }

      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
        return errorResponse('Desteklenmeyen dosya uzantısı', 400)
      }

      if (file.size > MAX_FILE_SIZE) {
        return errorResponse('Dosya boyutu 20MB limitini aşıyor', 400)
      }

      const notebookIdParam = formData.get('notebookId') as string | null
      const titleParam = formData.get('title') as string | null

      const { notebook, notebookId } = await getOrCreateNotebook(
        orgId,
        notebookIdParam || undefined,
        titleParam || undefined,
      )

      const s3Key = `ai-studio/docs/${orgId}/${crypto.randomUUID()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      await uploadBuffer(s3Key, buffer, file.type)

      // Belgeyi hemen ready olarak kaydet — sidecar'a ekleme arka planda
      const source = await prisma.aiNotebookSource.create({
        data: {
          notebookId,
          fileName: file.name,
          fileType: ext || '',
          fileSize: file.size,
          s3Key,
          sourceType: 'file',
          status: 'ready',
        },
      })

      // Sidecar'a kaynak ekleme — fire-and-forget (kullanıcıyı bloklamaz)
      addFileSource(notebook.notebookLmId, buffer, file.name, orgId)
        .then(result => {
          prisma.aiNotebookSource.update({
            where: { id: source.id },
            data: { sourceLmId: result.source_id },
          }).catch(() => {})
        })
        .catch(err => {
          logger.error('AI Documents', 'Sidecar kaynak ekleme hatası (arka plan)', err)
        })

      return jsonResponse(
        {
          source: {
            id: source.id,
            notebookId,
            fileName: source.fileName,
            fileSize: source.fileSize,
            status: source.status,
          },
        },
        201,
      )
    }

    if (contentType.includes('application/json')) {
      const body = await parseBody<Record<string, unknown>>(request)
      if (!body) return errorResponse('Geçersiz istek gövdesi', 400)

      const parsed = aiSourceAddSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0]?.message || 'Geçersiz veri', 400)
      }

      const { notebook, notebookId } = await getOrCreateNotebook(
        orgId,
        parsed.data.notebookId,
        parsed.data.title,
      )

      const fileName =
        parsed.data.sourceType === 'text'
          ? parsed.data.textTitle || 'Metin Kaynağı'
          : parsed.data.url || 'URL Kaynağı'

      // Belgeyi hemen ready olarak kaydet
      const source = await prisma.aiNotebookSource.create({
        data: {
          notebookId,
          fileName,
          fileType: parsed.data.sourceType,
          fileSize: parsed.data.content ? Buffer.byteLength(parsed.data.content, 'utf-8') : 0,
          sourceType: parsed.data.sourceType,
          sourceUrl: parsed.data.url || null,
          status: 'ready',
        },
      })

      // Sidecar'a kaynak ekleme — fire-and-forget
      addSource(notebook.notebookLmId, parsed.data.sourceType, {
        url: parsed.data.url,
        title: parsed.data.textTitle,
        content: parsed.data.content,
      }, orgId)
        .then(result => {
          prisma.aiNotebookSource.update({
            where: { id: source.id },
            data: { sourceLmId: result.source_id },
          }).catch(() => {})
        })
        .catch(err => {
          logger.error('AI Documents', 'Sidecar kaynak ekleme hatası (arka plan)', err)
        })

      return jsonResponse(
        {
          source: {
            id: source.id,
            notebookId,
            fileName: source.fileName,
            fileSize: source.fileSize,
            status: source.status,
          },
        },
        201,
      )
    }

    return errorResponse('Desteklenmeyen Content-Type', 400)
  } catch (err) {
    if (err instanceof AiServiceError) {
      logger.warn('AI Documents', `Sidecar hatası: ${err.message}`, { code: err.code, status: err.status })
      if (err.code === 'connection_error') {
        return errorResponse('AI içerik servisi çalışmıyor. Lütfen servisi başlatın veya daha sonra tekrar deneyin.', 503)
      }
      if (err.code === 'timeout') {
        return errorResponse('AI servisi yanıt vermedi. Lütfen tekrar deneyin.', 504)
      }
      return errorResponse(err.message, err.status)
    }
    logger.error('AI Documents', 'Beklenmeyen hata', err)
    return errorResponse('İşlem sırasında bir hata oluştu', 500)
  }
}
