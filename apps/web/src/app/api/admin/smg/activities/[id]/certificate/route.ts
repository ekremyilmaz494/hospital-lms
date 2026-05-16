import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { getDownloadUrl } from '@/lib/s3'

export const GET = withAdminRoute<{ id: string }>(async ({ params, organizationId }) => {
  const { id } = params

  const activity = await prisma.smgActivity.findFirst({
    where: { id, organizationId },
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
}, { requireOrganization: true })
