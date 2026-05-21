/**
 * Sınav/eğitim akışındaki POST isteklerinin **yanıt sınıflandırması** ve **retry**
 * yardımcıları.
 *
 * Neden var: Video izleme sayfası (`exam/[id]/videos/page.tsx`) ve transition sayfası
 * birçok POST isteğini tek bir `.catch()` ile yutuyordu — backend 400 (faz geçersiz),
 * 404 (içerik silinmiş), 401 (oturum bitti) gibi anlamlı kodlar dönerken frontend
 * hepsini "bağlantı sorunu" sayıyordu. Bu modül HTTP kodunu anlamlı bir sınıfa çevirir,
 * geçici hatalarda backoff'lu retry uygular, kalıcı hatalarda hemen döner.
 *
 * Saf ve yan etkisizdir (yalnızca `fetch` + `setTimeout`); kolay unit-test edilir.
 */

/**
 * Bir POST yanıtının anlamı:
 * - `ok`              — başarılı (2xx, 204 dahil).
 * - `transient`       — geçici hata: ağ kopması, abort, 5xx, 429. Retry edilebilir.
 * - `session-expired` — 401: oturum doldu. Login'e yönlendirilmeli.
 * - `phase-invalid`   — 400: attempt artık beklenen fazda değil (silinmiş/expire/ilerlemiş).
 * - `content-gone`    — 404: istenen içerik (video/soru) artık mevcut değil.
 * - `locked`          — 423: kaynak kilitli (örn. bekleyen zorunlu geri bildirim).
 */
export type ExamPostResultKind =
  | 'ok'
  | 'transient'
  | 'session-expired'
  | 'phase-invalid'
  | 'content-gone'
  | 'locked'

/** `ExamPostResultKind` içinde retry edilmemesi gereken kalıcı hata sınıfları. */
export const FATAL_EXAM_POST_KINDS: readonly ExamPostResultKind[] = [
  'session-expired',
  'phase-invalid',
  'content-gone',
  'locked',
] as const

/** `kind`'in retry edilemez (kalıcı) bir hata olup olmadığını söyler. */
export function isFatalExamPostKind(kind: ExamPostResultKind): boolean {
  return FATAL_EXAM_POST_KINDS.includes(kind)
}

/**
 * Bir `fetch` sonucunu (`Response`) veya `fetch`'in fırlattığı hatayı `ExamPostResultKind`'e
 * çevirir.
 *
 * @param input - Başarılı/başarısız `Response` ya da `fetch`'in throw ettiği hata (ağ/abort).
 * @returns İsteğin anlamlı sınıfı.
 */
export function classifyExamPostResult(input: Response | unknown): ExamPostResultKind {
  // fetch throw etti → ağ kopması / abort / DNS — her durumda geçici kabul edilir.
  if (!(input instanceof Response)) return 'transient'

  const status = input.status
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401) return 'session-expired'
  if (status === 400) return 'phase-invalid'
  if (status === 404) return 'content-gone'
  if (status === 423) return 'locked'
  // 5xx ve 429 (rate limit) geçicidir; beklenmeyen diğer 4xx'ler de retry edilip
  // tükenince çağırana 'transient' olarak görünür (hard-fail'den güvenli).
  return 'transient'
}

/** `postWithRetry` seçenekleri. */
export interface PostWithRetryOptions {
  /** Geçici hatada toplam ek deneme sayısı (ilk denemeye ek). Varsayılan 2. */
  retries?: number
  /** Denemeler arası bekleme (ms). i. retry için `backoff[min(i, len-1)]`. Varsayılan [2000, 5000]. */
  backoff?: number[]
  /** İsteği iptal etmek için signal — retry beklemesi de bu signal'le kesilir. */
  signal?: AbortSignal
}

/** `postWithRetry` dönüş tipi. */
export interface ExamPostResult<T = unknown> {
  /** İsteğin anlamlı sınıfı. */
  kind: ExamPostResultKind
  /** Yanıt alındıysa HTTP status; ağ hatasında `null`. */
  status: number | null
  /** `kind === 'ok'` ise parse edilmiş gövde (204'te `null`); aksi halde `null`. */
  data: T | null
}

const DEFAULT_RETRIES = 2
const DEFAULT_BACKOFF = [2000, 5000]
/** Backoff'a uygulanan ± oran (thundering-herd önlemek için jitter). */
const JITTER_RATIO = 0.2

/** Abort edilebilir bekleme. Signal zaten/abort olursa hemen döner. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** `base` ms'ye ±JITTER_RATIO jitter uygular. */
function withJitter(base: number): number {
  const delta = base * JITTER_RATIO
  return Math.round(base - delta + Math.random() * delta * 2)
}

/**
 * JSON gövdeli bir POST isteğini, geçici hatalarda backoff'lu retry ile gönderir.
 *
 * Davranış:
 * - Başarılı (2xx) → `{ kind: 'ok', data }` (204'te `data: null`).
 * - Kalıcı hata (401/400/404/423) → retry YAPILMADAN hemen döner.
 * - Geçici hata (ağ/5xx/429) → `backoff` ile `retries` kez tekrar; tükenince `transient` döner.
 *
 * @param url - İstek URL'i.
 * @param body - JSON'a çevrilecek gövde.
 * @param options - Retry/backoff/signal ayarları.
 * @returns Sınıflandırılmış sonuç.
 */
export async function postWithRetry<T = unknown>(
  url: string,
  body: unknown,
  options?: PostWithRetryOptions,
): Promise<ExamPostResult<T>> {
  const retries = options?.retries ?? DEFAULT_RETRIES
  const backoff = options?.backoff ?? DEFAULT_BACKOFF
  const signal = options?.signal

  let lastTransient: ExamPostResult<T> = { kind: 'transient', status: null, data: null }

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return lastTransient

    let kind: ExamPostResultKind
    let status: number | null = null
    let res: Response | null = null

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      status = res.status
      kind = classifyExamPostResult(res)
    } catch (err) {
      kind = classifyExamPostResult(err)
    }

    if (kind === 'ok') {
      // 204 veya gövdesiz yanıtta JSON parse hatası 'ok'u bozmamalı.
      const data = res && res.status !== 204
        ? ((await res.json().catch(() => null)) as T | null)
        : null
      return { kind, status, data }
    }

    if (isFatalExamPostKind(kind)) {
      return { kind, status, data: null }
    }

    // transient — son deneme değilse backoff ile tekrar dene.
    lastTransient = { kind: 'transient', status, data: null }
    if (attempt < retries) {
      const wait = withJitter(backoff[Math.min(attempt, backoff.length - 1)] ?? 0)
      await sleep(wait, signal)
    }
  }

  return lastTransient
}
