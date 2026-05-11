import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { signMultipartParts } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * POST /api/upload/multipart/sign
 * Bir veya daha fazla parça numarası için presigned PUT URL'leri döner.
 * Client paralel olarak bu URL'lere parça gönderir.
 */
export const POST = withAdminRoute(async ({ request }) => {
  try {
    const body = await request.json() as { key: string; uploadId: string; partNumbers: number[] }
    const { key, uploadId, partNumbers } = body

    if (!key || !uploadId || !Array.isArray(partNumbers) || partNumbers.length === 0) {
      return errorResponse('key, uploadId ve partNumbers gerekli', 400)
    }
    if (partNumbers.length > 100) {
      return errorResponse('Tek istekte en fazla 100 parça imzalanabilir', 400)
    }
    if (partNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 10_000)) {
      return errorResponse('Geçersiz parça numarası (1-10000 arası tamsayı olmalı)', 400)
    }

    const urls = await signMultipartParts(key, uploadId, partNumbers)

    // Teşhis: ilk URL'in imzalanmış header listesini logla. Flexible-checksums
    // middleware'i x-amz-checksum-crc32'yi signed-headers'a eklediyse browser
    // PUT'unda signature mismatch alıyoruz; bu log o hipotezi kanıtlar/çürütür.
    try {
      const sample = new URL(urls[0].url)
      const signedHeaders = sample.searchParams.get('X-Amz-SignedHeaders') ?? '(yok)'
      logger.info('multipart-sign', `Parça URL imzalandi`, {
        key,
        partCount: urls.length,
        signedHeaders,
        paramCount: sample.searchParams.size,
      })
    } catch { /* log best-effort */ }

    return jsonResponse({ urls })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parça URL imzalanamadı'
    return errorResponse(msg, 400)
  }
}, { requireOrganization: true })
