/**
 * İK/HBYS personel entegrasyonu ayar sayfası — ortak tipler + Türkçe etiketler.
 * API yanıt şekilleri route dosyalarından çıkarıldı:
 * - GET /api/admin/integration            → { integrations: IntegrationConfig[] }
 * - GET /api/admin/integration/keys       → { keys: ApiKeyItem[] }
 * - GET /api/admin/integration/runs       → { runs: SyncRunItem[]; pagination }
 * - GET /api/admin/integration/runs/[id]  → { run, rows, pagination }
 */

export type Channel = 'push' | 'file' | 'pull';
export type SyncModeValue = 'delta' | 'snapshot';
export type PullAuthTypeValue = 'bearer' | 'basic' | 'header_key';
export type PaginationStyle = 'page' | 'offset' | 'cursor';
export type RunStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'aborted';
export type RunTrigger = 'api' | 'file' | 'schedule' | 'manual';
export type RunMode = 'dry_run' | 'apply';
export type RowAction = 'create' | 'update' | 'deactivate' | 'reactivate' | 'skip' | 'conflict' | 'error';

export interface PullPagination {
  style: PaginationStyle;
  pageParam?: string;
  sizeParam?: string;
  pageSize?: number;
  itemsPath?: string;
  cursorPath?: string;
}

export interface IntegrationConfig {
  id: string;
  channel: Channel;
  isActive: boolean;
  syncMode: SyncModeValue;
  fieldMapping: Record<string, string> | null;
  defaults: Record<string, string | number | boolean> | null;
  deactivateMissing: boolean;
  deactivateThresholdPct: number;
  pullBaseUrl: string | null;
  pullAuthType: PullAuthTypeValue | null;
  pullIntervalMinutes: number | null;
  pullPagination: PullPagination | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  createdAt: string;
  updatedAt: string;
  /** Şifreli credential kaydı var mı — ham değer ASLA istemciye gelmez. */
  pullCredentialsSet: boolean;
}

export interface IntegrationListResponse {
  integrations: IntegrationConfig[];
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface KeysResponse {
  keys: ApiKeyItem[];
}

/** POST /keys yanıtı — plaintext YALNIZ bu yanıtta bir kez döner. */
export interface CreatedKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  expiresAt: string | null;
  createdAt: string;
  plaintext: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SyncRunItem {
  id: string;
  integrationId: string | null;
  channel: Channel;
  trigger: RunTrigger;
  mode: RunMode;
  syncMode: SyncModeValue;
  status: RunStatus;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  deactivatedRows: number;
  reactivatedRows: number;
  skippedRows: number;
  failedRows: number;
  fileName: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface RunsResponse {
  runs: SyncRunItem[];
  pagination: PaginationMeta;
}

export interface SyncRowItem {
  id: string;
  rowIndex: number;
  externalId: string | null;
  action: RowAction;
  userId: string | null;
  message: string | null;
  payloadMasked: Record<string, unknown> | null;
  createdAt: string;
}

export interface RunDetailResponse {
  run: SyncRunItem & { errorSummary: unknown };
  rows: SyncRowItem[];
  pagination: PaginationMeta;
}

/** POST /test-connection yanıtı (her iki durum da HTTP 200). */
export interface TestConnectionResult {
  ok: boolean;
  message?: string;
  sampleFields?: string[];
  sampleRows?: Record<string, unknown>[];
  totalFetched?: number;
  truncated?: boolean;
}

// ── Feature gate ──
export const FEATURE_DISABLED_MSG = 'Personel entegrasyonu planınızda etkin değil.';

// ── Türkçe etiket haritaları ──
export const CHANNEL_LABELS: Record<Channel, string> = {
  push: 'Push (API)',
  file: 'Dosya',
  pull: 'Pull (Çekme)',
};

export const TRIGGER_LABELS: Record<RunTrigger, string> = {
  api: 'API (push)',
  file: 'Dosya yükleme',
  schedule: 'Zamanlanmış',
  manual: 'Manuel',
};

export const STATUS_META: Record<RunStatus, { label: string; badge: string }> = {
  running: { label: 'Çalışıyor', badge: 'k-badge-info' },
  completed: { label: 'Tamamlandı', badge: 'k-badge-success' },
  completed_with_errors: { label: 'Hatalarla tamamlandı', badge: 'k-badge-warning' },
  failed: { label: 'Başarısız', badge: 'k-badge-error' },
  aborted: { label: 'Durduruldu', badge: 'k-badge-error' },
};

export const ACTION_META: Record<RowAction, { label: string; badge: string }> = {
  create: { label: 'Oluşturuldu', badge: 'k-badge-success' },
  update: { label: 'Güncellendi', badge: 'k-badge-info' },
  deactivate: { label: 'Pasifleştirildi', badge: 'k-badge-warning' },
  reactivate: { label: 'Yeniden aktifleştirildi', badge: 'k-badge-success' },
  skip: { label: 'Atlandı', badge: 'k-badge-muted' },
  conflict: { label: 'Çakışma', badge: 'k-badge-warning' },
  error: { label: 'Hata', badge: 'k-badge-error' },
};

/** Hedef personel alanları — Alan Eşleme sekmesindeki sabit liste. */
export const TARGET_FIELDS: { value: string; label: string }[] = [
  { value: 'externalId', label: 'Harici ID (sicil no)' },
  { value: 'firstName', label: 'Ad' },
  { value: 'lastName', label: 'Soyad' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
  { value: 'tcKimlik', label: 'TC Kimlik No' },
  { value: 'departmentName', label: 'Departman' },
  { value: 'title', label: 'Ünvan' },
  { value: 'hireDate', label: 'İşe giriş tarihi' },
  { value: 'active', label: 'Aktif / Pasif' },
];

// ── Yardımcılar ──

/** ISO tarihi "1 Tem 2026 14:30" biçiminde göster; null → uzun tire. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Test bağlantısı örnek satırlarında değerleri maskeler (KVKK — PII ekrana ham basılmaz). */
export function maskValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const s = String(value);
  if (s.length <= 2) return '••';
  return s.slice(0, 2) + '•'.repeat(Math.min(s.length - 2, 8));
}

/** SyncRun.errorSummary (Json) → kullanıcıya gösterilecek Türkçe metin. */
export function errorSummaryText(summary: unknown): string | null {
  if (summary === null || summary === undefined) return null;
  if (typeof summary === 'string') return summary;
  if (typeof summary === 'object' && 'message' in summary && typeof (summary as { message: unknown }).message === 'string') {
    return (summary as { message: string }).message;
  }
  try {
    return JSON.stringify(summary);
  } catch {
    return null;
  }
}
