/**
 * İK/HBYS personel senkron entegrasyonu — paylaşılan tipler.
 *
 * Akış: ham feed satırları → `normalize.ts` (mapping + defaults + zod) →
 * `StaffRecord[]` → `ingest.ts` `runSync` (plan + apply) → `SyncResult`.
 * Faz 2 route'ları (push/file/pull) yalnız bu sözleşmeyi kullanır.
 */

/** İK/HBYS feed'inden normalize edilmiş tek personel kaydı. */
export interface StaffRecord {
  /** Dış sistem anahtarı (personel/sicil no) — eşleşme önceliği 1 */
  externalId?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  /** Normalize edilmiş (yalnız rakam) ve checksum'ı doğrulanmış TC Kimlik No */
  tcKimlik?: string
  /** Departman adı — org departmanlarıyla fuzzy eşlenir, yoksa auto-create */
  departmentName?: string
  /** Doğrudan departman id'si (org-scope doğrulanır) — departmentName'e önceliklidir */
  departmentId?: string
  title?: string
  /** İşe giriş tarihi — ISO string (YYYY-MM-DD veya tam ISO) */
  hireDate?: string
  /** false = kaynak sistemde ayrılmış personel → deaktive edilir (delta'da dahi) */
  active?: boolean
}

/** normalize.ts satır hatası — rowIndex, `rawRows` dizisindeki 0-bazlı index. */
export interface NormalizeRowError {
  rowIndex: number
  /** Türkçe, kullanıcıya gösterilebilir hata mesajı */
  message: string
}

/** `normalizeRecords` çıktısı. `records` yalnız geçerli satırları içerir (sıra korunur). */
export interface NormalizeResult {
  records: StaffRecord[]
  rowErrors: NormalizeRowError[]
}

// ── runSync sözleşmesi ────────────────────────────────────────────────────

export type SyncChannelType = 'push' | 'file' | 'pull'
export type SyncTriggerType = 'api' | 'file' | 'schedule' | 'manual'
export type SyncModeType = 'delta' | 'snapshot'
export type SyncRowActionType =
  | 'create'
  | 'update'
  | 'deactivate'
  | 'reactivate'
  | 'skip'
  | 'conflict'
  | 'error'
export type SyncRunStatusType =
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'aborted'

/** `runSync` seçenekleri — Faz 2 route'ları bu sözleşmeyle çağırır. */
export interface SyncOptions {
  organizationId: string
  channel: SyncChannelType
  trigger: SyncTriggerType
  /** delta = yalnız gönderilen kayıtlar; snapshot = feed TAM liste kabul edilir */
  syncMode: SyncModeType
  /** true = yalnız plan çıkar, hiçbir yazma yapılmaz (satır sonuçları yine persist edilir) */
  dryRun: boolean
  /** snapshot modda feed'de olmayan entegrasyon-yönetimli personeli deaktive et */
  deactivateMissing?: boolean
  /** Güvenlik eşiği yüzdesi — varsayılan 20 (StaffIntegration.deactivateThresholdPct) */
  deactivateThresholdPct?: number
  /** Güvenlik eşiğini bilinçli geç (yalnız admin manuel tetiği için) */
  force?: boolean
  integrationId?: string | null
  apiKeyId?: string | null
  requestedById?: string | null
  fileName?: string | null
  /** Kayıtta departman bilgisi yoksa create'lerde kullanılacak departman */
  defaultDepartmentId?: string | null
}

/** SyncRun sayaçları — SyncRowResult action'larından türetilir. */
export interface SyncCounts {
  totalRows: number
  createdRows: number
  updatedRows: number
  deactivatedRows: number
  reactivatedRows: number
  skippedRows: number
  /** error + conflict satırları (conflict manuel çözüm bekler, uygulanmaz) */
  failedRows: number
}

/** Tek satırın sonucu (SyncRowResult özeti — payloadMasked response'a dahil edilmez). */
export interface SyncRowOutcome {
  /**
   * `records` dizisindeki 0-bazlı index. Snapshot deaktivasyon satırları feed'de
   * olmadığı için `records.length`'ten devam eden sanal index alır.
   */
  rowIndex: number
  action: SyncRowActionType
  externalId: string | null
  userId: string | null
  /** Türkçe açıklama (hata/çakışma/atlama nedeni) */
  message: string | null
}

/** `runSync` dönüşü. */
export interface SyncResult {
  runId: string
  status: SyncRunStatusType
  counts: SyncCounts
  rowResults: SyncRowOutcome[]
}
