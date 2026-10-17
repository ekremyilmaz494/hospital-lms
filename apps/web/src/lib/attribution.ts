import { z } from 'zod/v4'

/**
 * Demo/iletişim formu pazarlama atfı: oturumun İLK açılışındaki UTM'ler, açılış yolu
 * ve referrer host'u. sessionStorage'da tutulur (çerez değil, sekme kapanınca silinir)
 * ve yalnız form gönderilirken sunucuya gider (ContactMessage.utm_* kolonları).
 *
 * Şema hem istemcide hem `POST /api/public/demo-request`'te kullanılır; geçersiz atıf
 * isteği BOZMAZ, yalnız yok sayılır.
 */

const ATTRIBUTION_KEY = 'kv_attribution'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

// Yazdırılabilir, kontrol karakteri içermeyen kısa metin
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\p{Cc}]*$/u)
    .transform((v) => (v.length > 0 ? v : undefined))
    .optional()

export const attributionSchema = z.object({
  utmSource: text(100),
  utmMedium: text(100),
  utmCampaign: text(150),
  utmTerm: text(150),
  utmContent: text(150),
  landingPath: z.string().trim().max(300).regex(/^\/[^\s]*$/).optional(),
  referrerHost: z.string().trim().max(200).regex(/^[a-z0-9.-]+$/i).optional(),
})

export type Attribution = z.infer<typeof attributionSchema>

/**
 * Gövdedeki `attribution` alanını doğrular. Geçersiz/eksikse `null` (istek yine işlenir).
 *
 * @param raw - istemciden gelen ham değer
 */
export function parseAttribution(raw: unknown): Attribution | null {
  const parsed = attributionSchema.safeParse(raw)
  if (!parsed.success) return null
  const hasAny = Object.values(parsed.data).some((v) => v !== undefined)
  return hasAny ? parsed.data : null
}

/**
 * Sayfa açılışında çağrılır. Oturumda kayıt yoksa ya da URL yeni UTM taşıyorsa yazar;
 * aynı oturumdaki iç gezinti ilk atfı ezmez.
 */
export function captureAttribution(): void {
  try {
    const url = new URL(window.location.href)
    const hasUtm = UTM_KEYS.some((k) => url.searchParams.has(k))
    if (!hasUtm && window.sessionStorage.getItem(ATTRIBUTION_KEY)) return

    let referrerHost: string | undefined
    if (document.referrer) {
      const host = new URL(document.referrer).hostname
      if (host && host !== url.hostname) referrerHost = host
    }
    const candidate = {
      utmSource: url.searchParams.get('utm_source') ?? undefined,
      utmMedium: url.searchParams.get('utm_medium') ?? undefined,
      utmCampaign: url.searchParams.get('utm_campaign') ?? undefined,
      utmTerm: url.searchParams.get('utm_term') ?? undefined,
      utmContent: url.searchParams.get('utm_content') ?? undefined,
      landingPath: url.pathname.slice(0, 300),
      referrerHost,
    }
    const parsed = attributionSchema.safeParse(candidate)
    if (parsed.success) window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(parsed.data))
  } catch {
    // Depolama kapalı veya geçersiz referrer: atıf isteğe bağlıdır.
  }
}

/** Form gönderiminde payload'a eklenecek atıf; yoksa `undefined`. */
export function readAttribution(): Attribution | undefined {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY)
    return raw ? (parseAttribution(JSON.parse(raw)) ?? undefined) : undefined
  } catch {
    return undefined
  }
}
