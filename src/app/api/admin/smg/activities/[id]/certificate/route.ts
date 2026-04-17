import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse } from '@/lib/api-helpers'
import { getDownloadUrl } from '@/lib/s3'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const { id } = await params

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId: dbUser!.organizationId! },
    select: { certificateUrl: true },
  })
  if (!activity) return errorResponse('Aktivite bulunamadı', 404)

  const headers = { 'Cache-Control': 'private, max-age=30' }

  if (!activity.certificateUrl) {
    return jsonResponse({ url: null, type: null }, 200, headers)
  }

  const cert = activity.certificateUrl
  const isS3Key = cert.startsWith('smg/') || cert.startsWith('certificates/')

  let url: string | null = null
  if (isS3Key) {
    url = await getDownloadUrl(cert)
  } else {
    // Harici URL — yalnızca HTTPS kabul edilir; javascript:, data:, http: XSS/phishing riski taşır
    try {
      const parsed = new URL(cert)
      if (parsed.protocol === 'https:') {
        url = cert
      }
    } catch {
      // geçersiz URL
    }
  }

  if (!url) {
    return jsonResponse({ url: null, type: null }, 200, headers)
  }

  // content type tespiti — dosya uzantısına göre
  const lower = cert.toLowerCase()
  let type: 'pdf' | 'image' | null = null
  if (lower.endsWith('.pdf')) type = 'pdf'
  else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) type = 'image'

  return jsonResponse({ url, type }, 200, headers)
}
