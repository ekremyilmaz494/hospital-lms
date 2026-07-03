/**
 * İK/HBYS personel entegrasyonu — ZAMANLANMIŞ PULL adaptörü.
 *
 * Akış: `fetchStaffFromRemote` hastanenin İK API'sini sayfalayarak çeker →
 * `normalizeRecords` (fieldMapping/defaults) → `runSync` (pull kanalı) →
 * `StaffIntegration.lastRunAt/lastRunStatus` güncellenir.
 *
 * Güvenlik değişmezleri:
 *  - Credential'lar DB'de AES-256-GCM şifreli (`crypto.decrypt` ile çözülür),
 *    loglara/yanıtlara ASLA yazılmaz.
 *  - Loglara URL path/query yazılmaz — yalnız host (path/query hasta/personel
 *    kimliği veya query-string token içerebilir).
 *  - SSRF: bulutta yalnız https + public host (aşağıda `assertSafePullUrl`).
 */
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ApiError } from '@/lib/api-helpers'
import { decrypt } from '@/lib/crypto'
import { isOnPrem } from '@/lib/deployment'
import { normalizeRecords } from '@/lib/integration/normalize'
import { runSync } from '@/lib/integration/ingest'
import type { StaffRecord, SyncCounts, SyncModeType } from '@/lib/integration/types'

// ── Sabitler ──────────────────────────────────────────────────────────────

/** Sayfa başına istek zaman aşımı. */
const REQUEST_TIMEOUT_MS = 30_000
/** Koşu başına sayfa tavanı — sonsuz sayfalama döngüsüne karşı. */
const MAX_PAGES = 50
/** Koşu başına satır tavanı — bellek/DB koruması. */
const MAX_ROWS = 10_000
const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 1000
/** StaffIntegration.lastRunStatus VarChar(30) — DB'ye yazmadan önce kırpılır. */
const LAST_RUN_STATUS_MAX = 30

// ── Tipler ────────────────────────────────────────────────────────────────

/** `fetchStaffFromRemote` için gereken minimum pull yapılandırması. */
export interface PullSourceConfig {
  pullBaseUrl: string | null
  pullAuthType: string | null
  pullCredentialsEncrypted: string | null
  pullPagination: unknown
}

/** Tam pull entegrasyon satırı (Prisma `StaffIntegration` ile yapısal uyumlu). */
export interface PullIntegration extends PullSourceConfig {
  id: string
  organizationId: string
  syncMode: SyncModeType
  deactivateMissing: boolean
  deactivateThresholdPct: number
  fieldMapping: unknown
  defaults: unknown
}

/** `fetchStaffFromRemote` dönüşü. */
export interface PullFetchResult {
  rows: Record<string, unknown>[]
  pages: number
  /** Tavana takıldı (sayfa/satır/maxPages) — kalan veri ÇEKİLMEDİ. */
  truncated: boolean
}

/** `runPullForIntegration` dönüşü — hata rethrow edilmez, burada raporlanır. */
export interface PullRunResult {
  ok: boolean
  runId?: string
  /** runSync koşu durumu (ok=true iken) — admin "şimdi çalıştır" yanıtı için. */
  status?: string
  /** runSync sayaçları (ok=true iken) — admin "şimdi çalıştır" yanıtı için. */
  counts?: SyncCounts
  error?: string
}

/** Manuel (admin) tetik seçenekleri — cron 'schedule' yolunda kullanılmaz. */
export interface PullRunOptions {
  /** true → hiçbir değişiklik uygulanmaz, yalnız plan SyncRun(dry_run) olarak yazılır. */
  dryRun?: boolean
  /** true → snapshot toplu-deaktivasyon güvenlik eşiği atlanır (YALNIZ manuel tetik). */
  force?: boolean
}

interface PullPaginationConfig {
  style: 'page' | 'offset' | 'cursor'
  pageParam: string
  sizeParam: string
  pageSize: number
  itemsPath: string | null
  cursorPath: string | null
}

// ── SSRF koruması ─────────────────────────────────────────────────────────

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal'] as const

/** IPv4 literal'i özel/yerel aralıkta mı? (127.x, 0.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x) */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return (
    a === 127 || a === 0 || a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

/** IPv6 literal'i (URL hostname'inde köşeli parantezli) loopback/link-local/ULA/v4-mapped mi? */
function isPrivateIpv6(host: string): boolean {
  if (!host.startsWith('[') || !host.endsWith(']')) return false
  const v6 = host.slice(1, -1).toLowerCase()
  return (
    v6 === '::1' || v6 === '::' ||
    v6.startsWith('fe80') ||               // link-local
    v6.startsWith('fc') || v6.startsWith('fd') || // unique-local (fc00::/7)
    v6.startsWith('::ffff:')               // IPv4-mapped (192.168.x gizleme hilesi)
  )
}

/**
 * Pull adresini SSRF'e karşı doğrular; geçerliyse parse edilmiş URL döner.
 *
 * Bulutta: https zorunlu; localhost/özel-IP/link-local/.local/.internal REDDEDİLİR.
 * On-prem'de: HIS LAN'da çalıştığından http + özel IP serbesttir (isOnPrem()).
 *
 * BİLİNÇLİ SINIR: DNS çözümü YAPILMAZ — özel IP'ye çözünen bir public alan adı
 * (veya DNS rebinding) bu katmanda yakalanmaz. URL parse + literal IP kontrolü
 * ucuz ilk savunmadır; kalan risk `redirect: 'error'` + 30 sn timeout ile
 * daraltılır, esas kontrol ağ katmanındadır (egress firewall / VPC).
 *
 * @throws {ApiError} 400 — geçersiz URL veya yasaklı hedef
 */
export function assertSafePullUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ApiError('Pull adresi geçerli bir URL değil', 400)
  }

  const onPrem = isOnPrem()
  if (onPrem) {
    // HIS sunucuları çoğunlukla LAN'da http konuşur — özel IP + http serbest,
    // yine de yalnız http(s) protokolleri kabul edilir (file:, ftp: vb. yasak).
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new ApiError('Pull adresi http:// veya https:// ile başlamalıdır', 400)
    }
    return url
  }

  if (url.protocol !== 'https:') {
    throw new ApiError('Pull adresi https:// ile başlamalıdır', 400)
  }

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    throw new ApiError('Pull adresi yerel/özel bir ağ hedefine işaret ediyor — bulut kurulumunda yalnız genel (public) adresler sorgulanabilir', 400)
  }

  return url
}

// ── Kimlik doğrulama başlıkları ───────────────────────────────────────────

/** Şifreli credential JSON'unu çözüp auth tipine göre HTTP başlıkları üretir. */
function buildAuthHeaders(integration: PullSourceConfig): Record<string, string> {
  if (!integration.pullAuthType) {
    throw new ApiError('Pull kimlik doğrulama tipi yapılandırılmamış', 400)
  }
  if (!integration.pullCredentialsEncrypted) {
    throw new ApiError('Pull kimlik bilgileri yapılandırılmamış', 400)
  }

  let creds: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(decrypt(integration.pullCredentialsEncrypted))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('geçersiz şekil')
    creds = parsed as Record<string, unknown>
  } catch {
    // decrypt hatası ENCRYPTION_KEY rotasyonu/bozuk kayıt demektir — detay loglanmaz
    // (credential sızıntısı riski), admin yapılandırmayı yeniden kaydetmeli.
    throw new ApiError('Pull kimlik bilgileri çözülemedi — yapılandırmayı yeniden kaydedin', 500)
  }

  switch (integration.pullAuthType) {
    case 'bearer': {
      const token = typeof creds.token === 'string' && creds.token ? creds.token : null
      if (!token) throw new ApiError('Bearer kimlik bilgisi eksik (token)', 400)
      return { Authorization: `Bearer ${token}` }
    }
    case 'basic': {
      const username = typeof creds.username === 'string' && creds.username ? creds.username : null
      const password = typeof creds.password === 'string' ? creds.password : null
      if (!username || password === null) throw new ApiError('Basic kimlik bilgisi eksik (username/password)', 400)
      return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }
    }
    case 'header_key': {
      const headerName = typeof creds.headerName === 'string' && creds.headerName ? creds.headerName : null
      const key = typeof creds.key === 'string' && creds.key ? creds.key : null
      if (!headerName || !key) throw new ApiError('Özel başlık kimlik bilgisi eksik (headerName/key)', 400)
      return { [headerName]: key }
    }
    default:
      throw new ApiError('Bilinmeyen kimlik doğrulama tipi', 400)
  }
}

// ── Sayfalama ─────────────────────────────────────────────────────────────

/** `pullPagination` Json kolonunu doğrulanmış config'e çevirir; yoksa null (tek istek). */
function parsePaginationConfig(raw: unknown): PullPaginationConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const cfg = raw as Record<string, unknown>
  const style = cfg.style
  if (style !== 'page' && style !== 'offset' && style !== 'cursor') return null

  const pageSizeRaw = typeof cfg.pageSize === 'number' && Number.isFinite(cfg.pageSize)
    ? Math.floor(cfg.pageSize)
    : DEFAULT_PAGE_SIZE
  const defaultPageParam = style === 'page' ? 'page' : style === 'offset' ? 'offset' : 'cursor'

  return {
    style,
    pageParam: typeof cfg.pageParam === 'string' && cfg.pageParam ? cfg.pageParam : defaultPageParam,
    sizeParam: typeof cfg.sizeParam === 'string' && cfg.sizeParam ? cfg.sizeParam : 'size',
    pageSize: Math.min(Math.max(pageSizeRaw, 1), MAX_PAGE_SIZE),
    itemsPath: typeof cfg.itemsPath === 'string' && cfg.itemsPath ? cfg.itemsPath : null,
    cursorPath: typeof cfg.cursorPath === 'string' && cfg.cursorPath ? cfg.cursorPath : null,
  }
}

/** Nokta-yolu çözümü (`data.items` → payload.data.items). Bulunamazsa undefined. */
function resolvePath(value: unknown, dotPath: string): unknown {
  let current: unknown = value
  for (const segment of dotPath.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Yanıttan personel dizisini çıkarır; dizi değilse Türkçe ApiError. */
function extractItems(payload: unknown, itemsPath: string | null): Record<string, unknown>[] {
  const target = itemsPath ? resolvePath(payload, itemsPath) : payload
  if (!Array.isArray(target)) {
    throw new ApiError(
      itemsPath
        ? `İK API yanıtında "${itemsPath}" yolunda personel dizisi bulunamadı — pullPagination.itemsPath ayarını kontrol edin`
        : 'İK API yanıtı bir personel dizisi değil — yanıt sarmalanmışsa pullPagination.itemsPath ayarlayın',
      502,
    )
  }
  // Yalnız nesne satırlar normalize edilebilir — dizi içindeki primitifler atlanır.
  return target.filter(
    (it): it is Record<string, unknown> => typeof it === 'object' && it !== null && !Array.isArray(it),
  )
}

// ── HTTP ──────────────────────────────────────────────────────────────────

/** Tek sayfayı çeker: 30 sn timeout, redirect yasak, JSON zorunlu. Log'da yalnız host. */
async function fetchJsonPage(url: URL, headers: Record<string, string>, host: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // SSRF: uzak sunucunun iç ağa (veya http'ye) yönlendirmesi takip edilmez.
      redirect: 'error',
      cache: 'no-store',
    })
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    throw new ApiError(
      timedOut
        ? `İK API isteği zaman aşımına uğradı (${REQUEST_TIMEOUT_MS / 1000} sn): ${host}`
        : `İK API sunucusuna bağlanılamadı: ${host}`,
      502,
    )
  }

  if (!res.ok) {
    throw new ApiError(`İK API isteği başarısız (HTTP ${res.status}): ${host}`, 502)
  }
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('json')) {
    throw new ApiError(`İK API yanıtı JSON değil (content-type: ${contentType || 'belirtilmemiş'}): ${host}`, 502)
  }
  try {
    return (await res.json()) as unknown
  } catch {
    throw new ApiError(`İK API yanıtı çözümlenemedi (geçersiz JSON): ${host}`, 502)
  }
}

/** Başarısız sayfada 1 kez yeniden dener; ikinci hata ApiError olarak yukarı gider. */
async function fetchPageWithRetry(url: URL, headers: Record<string, string>, host: string): Promise<unknown> {
  try {
    return await fetchJsonPage(url, headers, host)
  } catch (err) {
    // Log'da yalnız host — URL path/query ve kimlik bilgisi ASLA yazılmaz.
    logger.warn('staff-pull', 'Sayfa isteği başarısız — 1 kez yeniden denenecek', {
      host,
      err: err instanceof Error ? err.message : String(err),
    })
    return fetchJsonPage(url, headers, host)
  }
}

// ── fetchStaffFromRemote ──────────────────────────────────────────────────

/**
 * Hastanenin İK API'sinden ham personel satırlarını sayfalayarak çeker.
 *
 * Sayfalama `pullPagination` config'ine göre: `page` (1'den artan sayfa no),
 * `offset` (offset += pageSize) veya `cursor` (yanıttaki `cursorPath` nokta-yolu;
 * null/boş → son sayfa). Config yoksa tek istek atılır ve yanıt dizi olmalıdır.
 *
 * Tavanlar: en fazla 50 sayfa / 10.000 satır (veya `opts.maxPages`) — aşılırsa
 * koşu durur ve `truncated: true` döner (sessiz kırpma yok, logger.warn atılır).
 *
 * @param integration Pull yapılandırması (şifreli credential dahil)
 * @param opts.maxPages Sayfa tavanını düşürür (örn. bağlantı testi için 1)
 * @throws {ApiError} SSRF/yapılandırma hatası (400) veya uzak API hatası (502)
 */
export async function fetchStaffFromRemote(
  integration: PullSourceConfig,
  opts?: { maxPages?: number },
): Promise<PullFetchResult> {
  if (!integration.pullBaseUrl) {
    throw new ApiError('Pull adresi yapılandırılmamış', 400)
  }
  const baseUrl = assertSafePullUrl(integration.pullBaseUrl)
  const host = baseUrl.hostname
  const headers = buildAuthHeaders(integration)
  const pagination = parsePaginationConfig(integration.pullPagination)
  const maxPages = Math.min(Math.max(opts?.maxPages ?? MAX_PAGES, 1), MAX_PAGES)

  // Sayfalama yapılandırılmamış → tek istek, yanıtın kendisi dizi olmalı.
  if (!pagination) {
    const payload = await fetchPageWithRetry(baseUrl, headers, host)
    const rows = extractItems(payload, null)
    return { rows, pages: 1, truncated: false }
  }

  if (pagination.style === 'cursor' && !pagination.cursorPath) {
    throw new ApiError('Cursor sayfalaması için pullPagination.cursorPath gereklidir', 400)
  }

  const rows: Record<string, unknown>[] = []
  let pages = 0
  let truncated = false
  let pageNo = 1
  let offset = 0
  let cursor: string | null = null

  for (;;) {
    const url = new URL(baseUrl.toString())
    if (pagination.style === 'page') {
      url.searchParams.set(pagination.pageParam, String(pageNo))
      url.searchParams.set(pagination.sizeParam, String(pagination.pageSize))
    } else if (pagination.style === 'offset') {
      url.searchParams.set(pagination.pageParam, String(offset))
      url.searchParams.set(pagination.sizeParam, String(pagination.pageSize))
    } else if (cursor !== null) {
      // cursor stilinde ilk istek parametresiz gider; sonrakiler yanıttan gelen cursor'la.
      url.searchParams.set(pagination.pageParam, cursor)
    }

    const payload = await fetchPageWithRetry(url, headers, host)
    const items = extractItems(payload, pagination.itemsPath)
    rows.push(...items)
    pages++

    // Devam kararı: cursor'da yanıttaki sonraki-cursor; page/offset'te dolu sayfa sezgisi.
    let hasMore: boolean
    if (pagination.style === 'cursor') {
      const next = resolvePath(payload, pagination.cursorPath as string)
      cursor = typeof next === 'string' && next !== ''
        ? next
        : typeof next === 'number'
          ? String(next)
          : null
      hasMore = cursor !== null
    } else {
      hasMore = items.length >= pagination.pageSize
      pageNo++
      offset += pagination.pageSize
    }
    if (items.length === 0) hasMore = false

    // Satır tavanı — sessiz kırpma YOK, uyarı loglanır (yalnız host).
    if (rows.length >= MAX_ROWS) {
      const overflowed = rows.length > MAX_ROWS
      if (overflowed) rows.length = MAX_ROWS
      if (overflowed || hasMore) {
        truncated = true
        logger.warn('staff-pull', `Satır tavanına (${MAX_ROWS}) ulaşıldı — kalan veri çekilmedi`, {
          host, pages, rows: rows.length,
        })
      }
      break
    }
    if (!hasMore) break

    // Sayfa tavanı (varsayılan 50, test bağlantısında 1) — devam eden veri varken durduk.
    if (pages >= maxPages) {
      truncated = true
      logger.warn('staff-pull', `Sayfa tavanına (${maxPages}) ulaşıldı — kalan veri çekilmedi`, {
        host, pages, rows: rows.length,
      })
      break
    }
  }

  return { rows, pages, truncated }
}

// ── runPullForIntegration ─────────────────────────────────────────────────

/** Json kolonundaki fieldMapping'i normalize sözleşmesine indirger (yalnız string→string). */
function asFieldMapping(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') out[key] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Json kolonundaki defaults'u normalize sözleşmesine çevirir (normalize alan-bazlı filtreler). */
function asDefaults(value: unknown): Partial<StaffRecord> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Partial<StaffRecord>
}

/** lastRunStatus VarChar(30) — taşan özet DB hatası üretmesin diye kırpılır. */
function clampRunStatus(status: string): string {
  return status.length > LAST_RUN_STATUS_MAX ? status.slice(0, LAST_RUN_STATUS_MAX) : status
}

/**
 * Tek pull entegrasyonu için tam senkron koşusu: fetch → normalize → runSync →
 * `lastRunAt`/`lastRunStatus` güncelle.
 *
 * Hata RETHROW EDİLMEZ — cron'da bir org'un hatası diğerlerini durdurmasın diye
 * `{ ok:false, error }` döner ve `lastRunStatus`'a `failed: <kısa>` yazılır.
 *
 * @param integration   Pull kanalı StaffIntegration satırı
 * @param trigger       'schedule' (cron) | 'manual' (admin tetiği)
 * @param requestedById Manuel tetikte tetikleyen admin id'si (audit için)
 * @param opts          Manuel tetik seçenekleri (dryRun/force) — cron geçmez
 */
export async function runPullForIntegration(
  integration: PullIntegration,
  trigger: 'schedule' | 'manual',
  requestedById?: string | null,
  opts?: PullRunOptions,
): Promise<PullRunResult> {
  // Log bağlamı için yalnız host — tam URL (path/query) loglanmaz.
  let host = 'gecersiz-adres'
  try {
    host = new URL(integration.pullBaseUrl ?? '').hostname
  } catch { /* fetchStaffFromRemote zaten Türkçe hata üretir */ }

  const dryRun = opts?.dryRun ?? false

  try {
    const { rows, truncated } = await fetchStaffFromRemote(integration)
    const { records, rowErrors } = normalizeRecords(
      rows,
      asFieldMapping(integration.fieldMapping),
      asDefaults(integration.defaults),
    )

    const result = await runSync(records, {
      organizationId: integration.organizationId,
      channel: 'pull',
      trigger,
      syncMode: integration.syncMode,
      dryRun,
      // force yalnız manuel tetikte anlamlı — cron 'schedule' yolunda opts geçilmez.
      force: opts?.force ?? false,
      deactivateMissing: integration.deactivateMissing,
      deactivateThresholdPct: integration.deactivateThresholdPct,
      integrationId: integration.id,
      requestedById: requestedById ?? null,
    })

    // Dry-run kanal sağlığını temsil etmez — lastRunAt/lastRunStatus'a yazılmaz.
    if (!dryRun) {
      await prisma.staffIntegration.update({
        where: { id: integration.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: clampRunStatus(`${result.status}: ${result.counts.totalRows} satır`),
        },
      })
    }

    logger.info('staff-pull', 'Pull senkronu tamamlandı', {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      host,
      runId: result.runId,
      status: result.status,
      dryRun,
      fetchedRows: rows.length,
      normalizeErrors: rowErrors.length,
      truncated,
    })
    return { ok: true, runId: result.runId, status: result.status, counts: result.counts }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    try {
      // Dry-run hatası da kanal sağlığına yazılmaz (gerçek koşuların izi bozulmasın).
      if (!dryRun) {
        await prisma.staffIntegration.update({
          where: { id: integration.id },
          data: { lastRunAt: new Date(), lastRunStatus: clampRunStatus(`failed: ${message}`) },
        })
      }
    } catch (updateErr) {
      logger.error('staff-pull', 'lastRunStatus güncellenemedi', {
        integrationId: integration.id,
        err: updateErr instanceof Error ? updateErr.message : String(updateErr),
      })
    }
    logger.error('staff-pull', 'Pull senkronu başarısız', {
      integrationId: integration.id,
      organizationId: integration.organizationId,
      host,
      err: message,
    })
    return { ok: false, error: message }
  }
}
