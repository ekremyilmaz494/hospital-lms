import { getAuthUserStrict, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { brandingKey, uploadBuffer } from '@/lib/s3'
import { checkRateLimit } from '@/lib/redis'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_BANNER_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUserStrict()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin', 'super_admin'])
  if (roleError) return roleError

  const orgId = dbUser!.organizationId
  if (!orgId) return errorResponse('Organization not found', 403)

  const allowed = await checkRateLimit(`branding-upload:${dbUser!.id}`, 10, 3600)
  if (!allowed) return errorResponse('Çok fazla yükleme denemesi. 1 saat bekleyin.', 429)

  const formData = await request.formData().catch(() => null)
  if (!formData) return errorResponse('Geçersiz form verisi', 400)

  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file || !type || !['logo', 'login-banner'].includes(type)) {
    return errorResponse('Dosya ve tür gereklidir', 400)
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    return errorResponse('Sadece PNG, JPG, SVG veya WebP dosyaları yüklenebilir.', 400)
  }

  const maxSize = type === 'logo' ? MAX_LOGO_SIZE : MAX_BANNER_SIZE
  if (file.size > maxSize) {
    return errorResponse(`Dosya boyutu ${type === 'logo' ? '2MB' : '5MB'}'dan küçük olmalıdır.`, 400)
  }

  try {
    const key = brandingKey(orgId, type as 'logo' | 'login-banner', file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadBuffer(key, buffer, file.type)

    const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN
    const bucket = process.env.AWS_S3_BUCKET
    const region = process.env.AWS_REGION

    const publicUrl = cdnDomain && !cdnDomain.includes('your-')
      ? `${cdnDomain.startsWith('http') ? cdnDomain : `https://${cdnDomain}`}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

    return jsonResponse({ publicUrl, key })
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Yükleme hatası', 500)
  }
}
