/**
 * POST /api/integration/v1/files — İK/HBYS dosya adaptörü.
 *
 * Hastane İK'sı gecelik personel export'unu (xlsx/csv) makine API anahtarıyla
 * yükler. Akış:
 *
 *   multipart "file" → uzantı + boyut + magic-byte kontrolü
 *     → xlsx: `parseImportFile` (bulk-import ile aynı HEADER_ALIASES davranışı)
 *     → csv:  `parseCsv` (bağımlılıksız; `;` ayırıcı + BOM toleranslı) + aynı
 *             başlık alias çözümü
 *     → `normalizeRecords` (org file-config fieldMapping/defaults + zod)
 *     → `runSync` (channel: 'file', trigger: 'file')
 *
 * Query:
 *   ?mode=preview          → dryRun (hiçbir yazma yapılmaz, plan raporlanır)
 *   ?syncMode=delta|snapshot → org config'ini geçersiz kılar (yoksa config,
 *                              o da yoksa 'delta')
 *
 * Yanıt: { runId, status, counts, errors } — errors ilk 100 hata satırı
 * (validation = normalize aşaması, sync = ingest satır sonucu). TC/PII
 * loglara ve audit'e ASLA yazılmaz.
 */
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { jsonResponse, ApiError } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { withIntegrationRoute } from '@/lib/integration/route-handler'
import { parseImportFile, resolveHeader, type ParsedRow } from '@/lib/integration/staff-row'
import { parseCsv } from '@/lib/integration/csv'
import { normalizeRecords } from '@/lib/integration/normalize'
import { runSync } from '@/lib/integration/ingest'
import type { StaffRecord, SyncModeType } from '@/lib/integration/types'

// Dosya parse + senkron 2000 satıra kadar sürebilir — Vercel fonksiyon süresi.
export const maxDuration = 300

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_DATA_ROWS = 2000
const MAX_ERROR_ROWS = 100
// Org bazlı saatlik dosya limiti — gecelik export için 6/saat fazlasıyla yeter.
const FILE_RATE_LIMIT_PER_HOUR = 6

/** Yanıttaki tek hata satırı. `row` = dosyadaki 1-bazlı satır (başlık = 1). */
interface FileIngestError {
  row: number | null
  stage: 'validation' | 'sync'
  message: string
}

/**
 * Dosya adını audit/DB için temizler: path bileşenleri ve kontrol karakterleri
 * atılır, 255 karaktere kısaltılır. Boş kalırsa 'upload'.
 */
function sanitizeFileName(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() ?? ''
  const cleaned = Array.from(base)
    .filter(ch => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .trim()
    .slice(0, 255)
  return cleaned || 'upload'
}

/** parseImportFile'daki başlık normalizasyonunun aynısı (sondaki `*` + trim + lowercase). */
function normalizeHeaderName(raw: string): string {
  return raw.replace(/\*+$/, '').trim().toLowerCase()
}

/**
 * xlsx `ParsedRow` → normalize için ham satır. `password` bilinçli TAŞINMAZ —
 * entegrasyon hesapları ingest'in ürettiği geçici şifreyle açılır.
 * Departman: bulk-import'un çözdüğü id varsa o (alt departman öncelikli),
 * yoksa ham ad `departmentName` olarak geçer (ingest fuzzy/auto-create yapar).
 */
function parsedRowToRaw(row: ParsedRow): Record<string, unknown> {
  const subDeptId =
    (row.subDeptMatch === 'exact' || row.subDeptMatch === 'fuzzy') && row.subDeptId
      ? row.subDeptId
      : undefined
  const departmentId = subDeptId ?? row.deptId
  const raw: Record<string, unknown> = {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    title: row.title,
    tcKimlik: row.tcKimlik,
  }
  if (departmentId) raw.departmentId = departmentId
  else if (row.deptName) raw.departmentName = row.deptName
  return raw
}

/** Json alanını fieldMapping'e daraltır — yalnız string→string girişler alınır. */
function toFieldMapping(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 0) out[key] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Json alanını defaults'a daraltır — anahtar/değer doğrulamasını normalize + zod yapar. */
function toDefaults(value: unknown): Partial<StaffRecord> | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Partial<StaffRecord>
}

/**
 * CSV kayıtlarını ham satırlara çevirir — xlsx yolundaki `HEADER_ALIASES`
 * davranışının aynısı: tanınan başlık kanonik alana eşlenir; tanınmayan başlık
 * normalize edilmiş adıyla korunur ki org'un `fieldMapping`'i (kaynak alan →
 * StaffRecord alanı, anahtarlar küçük-harf normalize başlık adı) eşleyebilsin.
 */
function csvToRawRows(
  headers: string[],
  rows: Array<{ cells: string[]; line: number }>,
): { rawRows: Array<Record<string, unknown>>; rowNumbers: number[] } {
  const keys: Array<string | null> = headers.map(h => {
    const normalized = normalizeHeaderName(h)
    if (!normalized) return null
    return resolveHeader(normalized) ?? normalized
  })

  const rawRows: Array<Record<string, unknown>> = []
  const rowNumbers: number[] = []
  for (const row of rows) {
    const record: Record<string, unknown> = {}
    keys.forEach((key, i) => {
      if (key) record[key] = row.cells[i] ?? ''
    })
    rawRows.push(record)
    rowNumbers.push(row.line)
  }
  return { rawRows, rowNumbers }
}

// CSV'de kanonik 'department' başlığı StaffRecord'un 'departmentName' alanına
// gider (alt departman kavramı StaffRecord'ta yok — org fieldMapping'i isterse
// 'subdepartment'/'alt departman' kaynağını başka alana eşleyebilir).
const CSV_BASE_FIELD_MAPPING: Record<string, string> = { department: 'departmentName' }

export const POST = withIntegrationRoute(async ({ request, organizationId, apiKey, audit }) => {
  // ── Org bazlı saatlik dosya limiti (wrapper'ın IP/anahtar limitine EK) ──
  const fileAllowed = await checkRateLimit(
    `integration:file:${organizationId}`,
    FILE_RATE_LIMIT_PER_HOUR,
    3600,
  )
  if (!fileAllowed) {
    throw new ApiError(
      'Saatlik dosya yükleme limiti aşıldı (saatte en fazla 6 dosya). Lütfen daha sonra tekrar deneyin.',
      429,
    )
  }

  // ── Query parametreleri ──
  const url = new URL(request.url)
  const modeParam = url.searchParams.get('mode')
  if (modeParam !== null && modeParam !== 'preview') {
    throw new ApiError('Geçersiz mode parametresi — yalnız "preview" desteklenir', 400)
  }
  const dryRun = modeParam === 'preview'

  const syncModeParam = url.searchParams.get('syncMode')
  if (syncModeParam !== null && syncModeParam !== 'delta' && syncModeParam !== 'snapshot') {
    throw new ApiError('Geçersiz syncMode parametresi — "delta" veya "snapshot" olmalı', 400)
  }
  const syncModeOverride: SyncModeType | null =
    syncModeParam === 'delta' || syncModeParam === 'snapshot' ? syncModeParam : null

  // ── multipart/form-data → file ──
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    throw new ApiError('Dosya yüklenemedi. İstek multipart/form-data formatında olmalı.', 400)
  }
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new ApiError('"file" alanı zorunludur (multipart/form-data dosya alanı)', 400)
  }
  if (file.size === 0) throw new ApiError('Dosya boş', 400)
  if (file.size > MAX_FILE_BYTES) throw new ApiError("Dosya boyutu 10MB'ı aşamaz", 413)

  const lowerName = (file.name || '').toLowerCase()
  const isXlsx = lowerName.endsWith('.xlsx')
  const isCsv = lowerName.endsWith('.csv')
  if (!isXlsx && !isCsv) {
    throw new ApiError('Yalnız .xlsx veya .csv dosyaları kabul edilir', 400)
  }
  const fileName = sanitizeFileName(file.name)

  const arrayBuffer = await file.arrayBuffer()

  // ── Parse: ham satırlar + dosya satır numaraları ──
  let rawRows: Array<Record<string, unknown>>
  let rowNumbers: number[]

  if (isXlsx) {
    // Magic-byte kontrolü — bulk-import'taki sniff'in aynısı. .xlsx her zaman
    // ZIP konteyneridir (PK); CFB (eski .xls) burada zaten kabul edilmiyor.
    const header = new Uint8Array(arrayBuffer.slice(0, 4))
    const isZip = header[0] === 0x50 && header[1] === 0x4b
    if (!isZip) {
      throw new ApiError('Geçersiz dosya içeriği. Sadece gerçek Excel (.xlsx) dosyaları kabul edilir.', 400)
    }

    // parseImportFile satır limitini (2000, başlık dahil) kendi içinde uygular.
    const parsed = await parseImportFile(arrayBuffer, organizationId)
    if (parsed.parseError) throw new ApiError(parsed.parseError, 400)
    rawRows = parsed.rows.map(parsedRowToRaw)
    rowNumbers = parsed.rows.map(r => r.rowIndex)
  } else {
    // TextDecoder BOM'u söker; parseCsv de string başındaki BOM'a toleranslı.
    const text = new TextDecoder('utf-8').decode(arrayBuffer)
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      throw new ApiError(
        'CSV dosyası boş veya hatalı. İlk satır başlık olmalı: Ad, Soyad, E-posta, TC Kimlik No, Departman, Unvan',
        400,
      )
    }
    if (parsed.rows.length > MAX_DATA_ROWS) {
      throw new ApiError('Tek seferde en fazla 2000 satır işlenebilir. Lütfen dosyayı bölerek yükleyin.', 400)
    }
    const converted = csvToRawRows(parsed.headers, parsed.rows)
    rawRows = converted.rawRows
    rowNumbers = converted.rowNumbers
  }

  // ── Org'un file-channel entegrasyon config'i (opsiyonel) ──
  const config = await prisma.staffIntegration.findUnique({
    where: { organizationId_channel: { organizationId, channel: 'file' } },
    select: {
      id: true,
      isActive: true,
      syncMode: true,
      fieldMapping: true,
      defaults: true,
      deactivateMissing: true,
      deactivateThresholdPct: true,
    },
  })
  if (config && !config.isActive) {
    throw new ApiError('Dosya entegrasyonu bu kurum için devre dışı bırakılmış. Lütfen yöneticinizle iletişime geçin.', 403)
  }

  const configMapping = toFieldMapping(config?.fieldMapping)
  // CSV taban eşlemesi önce, org config'i üstüne yazar (aynı kaynak anahtarında config kazanır).
  const fieldMapping = isCsv
    ? { ...CSV_BASE_FIELD_MAPPING, ...(configMapping ?? {}) }
    : configMapping
  const defaults = toDefaults(config?.defaults)

  // ── Normalize (fieldMapping + defaults + zod; TC checksum dahil) ──
  const { records, rowErrors } = normalizeRecords(rawRows, fieldMapping, defaults)

  const errors: FileIngestError[] = []
  for (const err of rowErrors) {
    if (errors.length >= MAX_ERROR_ROWS) break
    errors.push({
      row: rowNumbers[err.rowIndex] ?? null,
      stage: 'validation',
      message: err.message,
    })
  }

  if (records.length === 0) {
    throw new ApiError('Dosyada işlenebilir personel satırı bulunamadı', 400, {
      errors,
    })
  }

  // records[j] → dosya satırı: normalize sıra korur, hatalı index'ler atlanır.
  const errorIndexSet = new Set(rowErrors.map(e => e.rowIndex))
  const validRowNumbers: number[] = []
  rowNumbers.forEach((num, i) => {
    if (!errorIndexSet.has(i)) validRowNumbers.push(num)
  })

  // ── Senkron çekirdeği (kilit doluysa runSync ApiError(409) fırlatır) ──
  const syncMode: SyncModeType = syncModeOverride ?? config?.syncMode ?? 'delta'
  const result = await runSync(records, {
    organizationId,
    channel: 'file',
    trigger: 'file',
    syncMode,
    dryRun,
    deactivateMissing: config?.deactivateMissing,
    deactivateThresholdPct: config?.deactivateThresholdPct,
    integrationId: config?.id ?? null,
    apiKeyId: apiKey.id,
    fileName,
  })

  for (const row of result.rowResults) {
    if (errors.length >= MAX_ERROR_ROWS) break
    if (row.action !== 'error' && row.action !== 'conflict') continue
    errors.push({
      // Snapshot deaktivasyonunun sanal satırları (feed dışı) dosya satırı taşımaz.
      row: validRowNumbers[row.rowIndex] ?? null,
      stage: 'sync',
      message: row.message ?? 'Satır işlenemedi',
    })
  }

  // Audit + log — TC/PII YAZILMAZ (yalnız dosya adı, mod ve sayaçlar).
  await audit({
    action: 'integration.file.ingest',
    entityType: 'sync_run',
    entityId: result.runId,
    newData: {
      fileName,
      syncMode,
      dryRun,
      counts: result.counts,
      validationErrorCount: rowErrors.length,
    },
  })
  logger.info('integration-file', 'Dosya senkronu tamamlandı', {
    organizationId,
    runId: result.runId,
    status: result.status,
    fileName,
    dryRun,
    syncMode,
  })

  return jsonResponse({
    runId: result.runId,
    status: result.status,
    counts: result.counts,
    errors,
  })
})
