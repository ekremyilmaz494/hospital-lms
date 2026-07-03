/**
 * POST /api/integration/v1/sync — İK/HBYS toplu personel senkronu (M2M push).
 *
 * Body: `{ mode: 'snapshot'|'delta', dryRun?, records: [1..2000] }`.
 * Snapshot güvenlik ayarları (deactivateMissing/threshold) org config'inden okunur;
 * `force` API'DEN ASLA geçilmez — eşik aşımı koşuyu 'aborted' bitirir (kaza koruması).
 * Anahtar/dakika limitinin ÜSTÜNE org-bazlı saatlik toplu senkron limiti (10/saat) uygulanır.
 * Auth/rate-limit/lisans/feature/idempotency `withIntegrationRoute`'ta.
 */
import { withIntegrationRoute } from '@/lib/integration/route-handler'
import { normalizeRecords } from '@/lib/integration/normalize'
import { runSync } from '@/lib/integration/ingest'
import { getPushConfig } from '@/lib/integration/push-helpers'
import { syncRequestSchema, firstIssueMessage } from '@/lib/integration/schemas'
import { ApiError, jsonResponse, parseBody } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import type { NormalizeRowError, SyncResult, SyncRowActionType } from '@/lib/integration/types'

// Vercel: 2000 satırlık koşu (Supabase auth create dahil) dakikalar sürebilir.
export const maxDuration = 300

/** Yanıtta raporlanan azami hata satırı — devamı sync-runs detay ucundan sayfalanır. */
const MAX_ERRORS_IN_RESPONSE = 100

const HOURLY_SYNC_LIMIT = 10
const HOURLY_WINDOW_SECONDS = 3600

interface SyncErrorRow {
  /** İstemcinin gönderdiği HAM `records` dizisindeki 0-bazlı index */
  rowIndex: number
  action: SyncRowActionType
  externalId: string | null
  userId: string | null
  message: string | null
}

/**
 * Normalize satır hatalarını + runSync error/conflict sonuçlarını istemcinin
 * gönderdiği HAM dizi index'iyle raporlar. (runSync rowIndex'i normalize'da
 * elenen satırlar kadar kayar — burada geri eşlenir; snapshot deaktivasyonunun
 * sanal satırları ham dizinin sonundan devam eder.)
 */
function buildErrorRows(
  rowErrors: NormalizeRowError[],
  result: SyncResult,
  rawCount: number,
): SyncErrorRow[] {
  const invalidRawIndexes = new Set(rowErrors.map(e => e.rowIndex))
  const validRawIndexes: number[] = []
  for (let i = 0; i < rawCount; i++) {
    if (!invalidRawIndexes.has(i)) validRawIndexes.push(i)
  }
  const toRawIndex = (recordIndex: number): number =>
    recordIndex < validRawIndexes.length
      ? (validRawIndexes[recordIndex] ?? recordIndex)
      : rawCount + (recordIndex - validRawIndexes.length)

  return [
    ...rowErrors.map((e): SyncErrorRow => ({
      rowIndex: e.rowIndex,
      action: 'error',
      externalId: null,
      userId: null,
      message: e.message,
    })),
    ...result.rowResults
      .filter(r => r.action === 'error' || r.action === 'conflict')
      .map((r): SyncErrorRow => ({
        rowIndex: toRawIndex(r.rowIndex),
        action: r.action,
        externalId: r.externalId,
        userId: r.userId,
        message: r.message,
      })),
  ]
    .sort((a, b) => a.rowIndex - b.rowIndex)
    .slice(0, MAX_ERRORS_IN_RESPONSE)
}

export const POST = withIntegrationRoute(async ({ request, organizationId, apiKey, audit }) => {
  const body = await parseBody<unknown>(request)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('Geçersiz veri', 400)
  }
  const parsed = syncRequestSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(firstIssueMessage(parsed.error), 400)
  const { mode, dryRun, records: rawRows } = parsed.data

  // Org-bazlı EK saatlik limit — toplu senkron pahalı; geçersiz gövdeler (üstte
  // 400'lenen) kotayı tüketmesin diye doğrulamadan SONRA sayılır.
  const hourlyAllowed = await checkRateLimit(
    `integration:sync:${organizationId}`,
    HOURLY_SYNC_LIMIT,
    HOURLY_WINDOW_SECONDS,
  )
  if (!hourlyAllowed) throw new ApiError('Saatlik toplu senkron limiti aşıldı.', 429)

  const config = await getPushConfig(organizationId)
  const { records, rowErrors } = normalizeRecords(rawRows, config?.fieldMapping, config?.defaults)

  // Hiç geçerli satır yoksa koşu başlatılmaz — özellikle snapshot'ta boş feed
  // toplu deaktivasyon kazası üretebilirdi.
  if (records.length === 0) {
    throw new ApiError('Gönderilen kayıtların hiçbiri doğrulanamadı', 422, {
      errors: rowErrors.slice(0, MAX_ERRORS_IN_RESPONSE),
    })
  }

  const result = await runSync(records, {
    organizationId,
    channel: 'push',
    trigger: 'api',
    syncMode: mode,
    dryRun,
    // Snapshot güvenlik ayarları YALNIZ org config'inden; `force` bilinçli olarak
    // API'ye açılmadı (yalnız admin manuel tetiği geçebilir).
    ...(mode === 'snapshot'
      ? {
          deactivateMissing: config?.deactivateMissing ?? false,
          ...(config ? { deactivateThresholdPct: config.deactivateThresholdPct } : {}),
        }
      : {}),
    integrationId: config?.id ?? null,
    apiKeyId: apiKey.id,
  })

  await audit({
    action: 'integration.staff.sync',
    entityType: 'sync_run',
    entityId: result.runId,
    newData: {
      mode,
      dryRun,
      status: result.status,
      counts: result.counts,
      invalidRows: rowErrors.length,
    },
  })

  return jsonResponse({
    runId: result.runId,
    status: result.status,
    counts: result.counts,
    errors: buildErrorRows(rowErrors, result, rawRows.length),
  })
})
