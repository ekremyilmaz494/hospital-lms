/**
 * Pure utility fonksiyonları — DB veya Redis bağımlılığı YOK.
 * Middleware (Edge Runtime) tarafından güvenle import edilebilir.
 */

/**
 * Host header'dan subdomain çıkarır.
 *
 * Örnekler:
 *  - "memorial-ankara.hastanelms.com" -> "memorial-ankara"
 *  - "hastanelms.com" -> null
 *  - "www.hastanelms.com" -> null
 *  - "localhost:3000" -> null
 */
export function extractSubdomain(host: string, baseDomain: string): string | null {
  const hostWithoutPort = host.split(':')[0]
  const baseWithoutPort = baseDomain.split(':')[0]

  if (hostWithoutPort === 'localhost' || hostWithoutPort === '127.0.0.1') {
    return null
  }

  if (!hostWithoutPort.endsWith(`.${baseWithoutPort}`)) {
    return null
  }

  const subdomain = hostWithoutPort.slice(0, -(baseWithoutPort.length + 1))

  if (!subdomain || subdomain === 'www') {
    return null
  }

  if (subdomain.includes('.')) {
    return null
  }

  return subdomain
}

/**
 * Hastane adından URL-safe slug üretir.
 * Türkçe karakterleri transliterate eder.
 */
export function slugify(text: string): string {
  const turkishMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u',
  }

  return text
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 50)
}
