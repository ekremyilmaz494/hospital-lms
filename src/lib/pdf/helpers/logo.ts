/**
 * Organization.logoUrl'den logo çek, base64 data URL döndür.
 *
 * - 3 saniye timeout (uzun bekleme → text fallback)
 * - MIME tespiti magic byte ile (PNG/JPEG)
 * - Başarısızlık silent → null döner, kapak sayfası text-only devam eder
 */

const FETCH_TIMEOUT_MS = 3000
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

function detectMimeType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length < 4) return null
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

export async function fetchLogoAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) return null

    const contentLength = Number(res.headers.get('content-length') ?? 0)
    if (contentLength > MAX_LOGO_BYTES) return null

    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_LOGO_BYTES) return null

    const bytes = new Uint8Array(buf)
    const mime = detectMimeType(bytes)
    if (!mime) return null

    const base64 = Buffer.from(bytes).toString('base64')
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

/** jsPDF addImage için format string. */
export function mimeToPdfFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}
