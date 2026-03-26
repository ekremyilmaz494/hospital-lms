import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'

// Next.js App Router — body size limit for this route
export const maxDuration = 120 // seconds

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.size === 0) {
      return errorResponse('Dosya gerekli', 400)
    }

    // Max 500MB
    if (file.size > 500 * 1024 * 1024) {
      return errorResponse('Dosya 500MB limitini aşıyor', 400)
    }

    // Only allow video types
    if (!file.type.startsWith('video/')) {
      return errorResponse('Sadece video dosyaları yüklenebilir', 400)
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${timestamp}-${safeName}`

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'videos')
    await mkdir(uploadDir, { recursive: true })

    const filePath = join(uploadDir, filename)
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const url = `/uploads/videos/${filename}`

    return jsonResponse({ url, filename, size: file.size })
  } catch (err) {
    console.error('[Video Upload Error]', err)
    return errorResponse('Video yüklenirken bir hata oluştu', 500)
  }
}
