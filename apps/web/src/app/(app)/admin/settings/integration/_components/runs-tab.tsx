'use client';

import { useState, useMemo } from 'react';
import { History, ChevronRight, ChevronLeft, ArrowLeft, RefreshCw, AlertTriangle, FlaskConical } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import {
  type RowAction,
  type RunsResponse,
  type RunDetailResponse,
  type SyncRunItem,
  CHANNEL_LABELS,
  TRIGGER_LABELS,
  STATUS_META,
  ACTION_META,
  formatDateTime,
  errorSummaryText,
} from './types';

const PAGE_LIMIT = 20;

const ACTION_FILTERS: { value: '' | RowAction; label: string }[] = [
  { value: '', label: 'Tüm işlemler' },
  { value: 'create', label: 'Oluşturulan' },
  { value: 'update', label: 'Güncellenen' },
  { value: 'deactivate', label: 'Pasifleştirilen' },
  { value: 'reactivate', label: 'Yeniden aktifleştirilen' },
  { value: 'skip', label: 'Atlanan' },
  { value: 'conflict', label: 'Çakışan' },
  { value: 'error', label: 'Hatalı' },
];

function Paginator({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--k-border)' }}>
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className="k-btn k-btn-ghost k-btn-sm" aria-label="Önceki sayfa">
        <ChevronLeft className="h-3.5 w-3.5" /> Önceki
      </button>
      <span className="text-[12px] tabular-nums" style={{ color: 'var(--k-text-muted)' }}>
        Sayfa {page} / {totalPages}
      </span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className="k-btn k-btn-ghost k-btn-sm" aria-label="Sonraki sayfa">
        Sonraki <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Koşu sayaçlarının kompakt Türkçe özeti ("3 oluşturuldu · 5 güncellendi …"). */
function countsSummary(run: SyncRunItem): string {
  const parts: string[] = [];
  if (run.createdRows > 0) parts.push(`${run.createdRows} oluşturuldu`);
  if (run.updatedRows > 0) parts.push(`${run.updatedRows} güncellendi`);
  if (run.deactivatedRows > 0) parts.push(`${run.deactivatedRows} pasifleştirildi`);
  if (run.reactivatedRows > 0) parts.push(`${run.reactivatedRows} yeniden aktif`);
  if (run.skippedRows > 0) parts.push(`${run.skippedRows} atlandı`);
  if (run.failedRows > 0) parts.push(`${run.failedRows} hata`);
  return parts.length > 0 ? parts.join(' · ') : 'Değişiklik yok';
}

export function RunsTab() {
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useFetch<RunsResponse>(
    `/api/admin/integration/runs?page=${page}&limit=${PAGE_LIMIT}`,
  );

  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => setSelectedRunId(null)} />;
  }

  const runs = data?.runs ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <section
      className="rounded-2xl border"
      style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
    >
      <div className="flex items-center gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}
        >
          <History className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
            Senkron Geçmişi
          </h3>
          <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
            Tüm kanallardaki senkron koşuları — satıra tıklayarak ayrıntıları görün.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
          Yükleniyor…
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</p>
          <button onClick={refetch} className="k-btn k-btn-ghost k-btn-sm mt-3">
            <RefreshCw className="h-3.5 w-3.5" /> Tekrar Dene
          </button>
        </div>
      ) : runs.length === 0 ? (
        <div className="p-10 text-center">
          <History className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--k-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--k-text-primary)' }}>Henüz senkron koşusu yok</p>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--k-text-muted)' }}>
            İlk push, dosya yüklemesi veya pull koşusu tamamlandığında burada listelenir.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                  {['Tarih', 'Kanal', 'Tetikleyici', 'Mod', 'Durum', 'Sonuç', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--k-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const status = STATUS_META[run.status];
                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className="cursor-pointer transition-colors hover:bg-[var(--k-surface-hover)]"
                      style={{ borderBottom: '1px solid var(--k-border)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: 'var(--k-text-primary)' }}>
                          {formatDateTime(run.startedAt)}
                        </div>
                        {run.fileName && (
                          <div className="mt-0.5 text-[11px]" style={{ color: 'var(--k-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                            {run.fileName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>
                        {CHANNEL_LABELS[run.channel]}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--k-text-secondary)' }}>
                        {TRIGGER_LABELS[run.trigger]}
                      </td>
                      <td className="px-4 py-3">
                        {run.mode === 'dry_run' ? (
                          <span className="k-badge k-badge-warning">
                            <FlaskConical className="h-3 w-3" /> Deneme
                          </span>
                        ) : (
                          <span className="k-badge k-badge-muted k-badge-no-dot">Uygulandı</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`k-badge ${status.badge}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--k-text-secondary)' }}>
                        <span className="tabular-nums">{run.totalRows} satır</span>
                        <span className="mx-1.5" style={{ color: 'var(--k-text-muted)' }}>—</span>
                        {countsSummary(run)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4" style={{ color: 'var(--k-text-muted)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginator page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [rowsPage, setRowsPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<'' | RowAction>('');

  const detailUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(rowsPage), limit: String(PAGE_LIMIT) });
    if (actionFilter) params.set('action', actionFilter);
    return `/api/admin/integration/runs/${runId}?${params.toString()}`;
  }, [runId, rowsPage, actionFilter]);

  const { data, isLoading, error, refetch } = useFetch<RunDetailResponse>(detailUrl);

  const run = data?.run;
  const rows = data?.rows ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;
  const errorText = run ? errorSummaryText(run.errorSummary) : null;

  const summaryCells = run
    ? [
        { label: 'Toplam', value: run.totalRows, badge: 'k-badge-muted' },
        { label: 'Oluşturulan', value: run.createdRows, badge: 'k-badge-success' },
        { label: 'Güncellenen', value: run.updatedRows, badge: 'k-badge-info' },
        { label: 'Pasifleştirilen', value: run.deactivatedRows, badge: 'k-badge-warning' },
        { label: 'Yeniden aktif', value: run.reactivatedRows, badge: 'k-badge-success' },
        { label: 'Atlanan', value: run.skippedRows, badge: 'k-badge-muted' },
        { label: 'Hatalı', value: run.failedRows, badge: 'k-badge-error' },
      ]
    : [];

  return (
    <section
      className="rounded-2xl border"
      style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', boxShadow: 'var(--k-shadow-sm)' }}
    >
      <div className="flex flex-wrap items-center gap-3 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
        <button onClick={onBack} className="k-btn k-btn-ghost k-btn-sm" aria-label="Geçmişe dön">
          <ArrowLeft className="h-3.5 w-3.5" /> Geri
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-display, system-ui)' }}>
            Koşu Detayı
          </h3>
          {run && (
            <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
              {formatDateTime(run.startedAt)} · {CHANNEL_LABELS[run.channel]} · {TRIGGER_LABELS[run.trigger]}
              {run.completedAt ? ` · Bitiş: ${formatDateTime(run.completedAt)}` : ''}
            </p>
          )}
        </div>
        {run && (
          <div className="flex items-center gap-2">
            {run.mode === 'dry_run' && (
              <span className="k-badge k-badge-warning">
                <FlaskConical className="h-3 w-3" /> Deneme
              </span>
            )}
            <span className={`k-badge ${STATUS_META[run.status].badge}`}>{STATUS_META[run.status].label}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
          Yükleniyor…
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</p>
          <button onClick={refetch} className="k-btn k-btn-ghost k-btn-sm mt-3">
            <RefreshCw className="h-3.5 w-3.5" /> Tekrar Dene
          </button>
        </div>
      ) : run ? (
        <>
          <div className="flex flex-wrap gap-2 p-5" style={{ borderBottom: '1px solid var(--k-border)' }}>
            {summaryCells.map((c) => (
              <span key={c.label} className={`k-badge ${c.badge}`}>
                {c.label}: <span className="tabular-nums">{c.value}</span>
              </span>
            ))}
          </div>

          {errorText && (
            <div className="px-5 pt-4">
              <div
                className="flex items-start gap-2 rounded-xl p-3 text-[12.5px] leading-snug"
                style={{ background: 'var(--k-error-bg)', color: 'var(--k-error)', border: '1px solid var(--k-error)' }}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
              Satır Sonuçları
            </p>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value as '' | RowAction);
                setRowsPage(1);
              }}
              aria-label="İşlem filtresi"
              className="k-input"
              style={{ maxWidth: 220 }}
            >
              {ACTION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 pb-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
              {actionFilter ? 'Bu filtreye uyan satır yok.' : 'Bu koşuda satır sonucu kaydedilmemiş.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderTop: '1px solid var(--k-border)', borderBottom: '1px solid var(--k-border)', background: 'var(--k-surface-hover)' }}>
                    {['#', 'Harici ID', 'İşlem', 'Mesaj'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--k-text-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = ACTION_META[row.action];
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--k-border)' }}>
                        <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--k-text-muted)' }}>
                          {row.rowIndex}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>
                          {row.externalId ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`k-badge ${meta.badge}`}>{meta.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px]" style={{ color: 'var(--k-text-secondary)' }}>
                          {row.message ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Paginator page={rowsPage} totalPages={totalPages} onChange={setRowsPage} />
        </>
      ) : (
        <p className="p-8 text-center text-sm" style={{ color: 'var(--k-text-muted)' }}>
          Koşu bulunamadı.
        </p>
      )}
    </section>
  );
}
