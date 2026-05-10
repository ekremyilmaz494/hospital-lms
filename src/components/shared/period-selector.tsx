'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, ChevronDown, Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { periodStatusLabel } from '@/lib/training-periods-helpers';
import type { TrainingPeriod, PeriodStatus } from '@/types/database';

interface PeriodSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
  /** "Tüm Dönemler" opsiyonunu göster. */
  includeAll?: boolean;
  className?: string;
}

const ALL_VALUE = '__all__';

// Modül seviyesi cache — sayfalar arası tekrar fetch'i engeller (60s)
let periodsCache: { data: TrainingPeriod[]; ts: number } | null = null;
let inflight: Promise<TrainingPeriod[]> | null = null;
const STALE_MS = 60_000;

async function fetchPeriods(): Promise<TrainingPeriod[]> {
  if (periodsCache && Date.now() - periodsCache.ts < STALE_MS) {
    return periodsCache.data;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/admin/training-periods', {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
      if (!res.ok) throw new Error('Eğitim dönemleri yüklenemedi');
      const data = (await res.json()) as TrainingPeriod[];
      periodsCache = { data, ts: Date.now() };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const STATUS_ORDER: PeriodStatus[] = ['active', 'upcoming', 'closed'];

const SECTION_LABEL: Record<PeriodStatus, string> = {
  active: 'Aktif Dönem',
  upcoming: 'Yaklaşan Dönemler',
  closed: 'Kapanmış Dönemler',
};

const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "1 Oca – 31 Ara 2026" — yıl tek seferde, kompakt tarih aralığı */
function formatRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sPart = `${s.getDate()} ${TR_MONTHS_SHORT[s.getMonth()]}${sameYear ? '' : ` ${s.getFullYear()}`}`;
  const ePart = `${e.getDate()} ${TR_MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  return `${sPart} – ${ePart}`;
}

/** Period.label'ından "2026 " yıl prefix'ini kaldırır — yıl ayrıca büyük gösteriliyor */
function stripYearPrefix(label: string): string {
  return label.replace(/^\d{4}\s*/, '').trim() || 'Eğitim Dönemi';
}

interface StatusPillProps {
  status: PeriodStatus | string;
  size?: 'sm' | 'md';
}

function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const palette = (() => {
    if (status === 'active') return { bg: 'var(--k-primary-light, #d1fae5)', dot: 'var(--k-primary, #0d9668)', text: 'var(--k-primary, #0d9668)' };
    if (status === 'upcoming') return { bg: 'var(--k-warning-bg, #fef3c7)', dot: 'var(--k-warning, #f59e0b)', text: '#92400e' };
    return { bg: 'var(--k-surface-hover, #f5f5f4)', dot: 'var(--k-text-muted, #78716c)', text: 'var(--k-text-muted, #78716c)' };
  })();
  const padX = size === 'md' ? 10 : 8;
  const fontSize = size === 'md' ? 11 : 10;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider"
      style={{ background: palette.bg, color: palette.text, padding: `3px ${padX}px`, fontSize, letterSpacing: '0.04em' }}
    >
      <span className="block rounded-full" style={{ background: palette.dot, width: 5, height: 5 }} />
      {periodStatusLabel(status)}
    </span>
  );
}

export function PeriodSelector({ value, onChange, includeAll = false, className }: PeriodSelectorProps) {
  const [periods, setPeriods] = useState<TrainingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPeriods()
      .then((data) => {
        if (cancelled) return;
        setPeriods(data);
        setLoading(false);
        // İlk açılışta seçili değer yoksa aktif period'u seç
        if (value === null && !includeAll) {
          const active = data.find((p) => p.status === 'active');
          if (active) onChange(active.id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<PeriodStatus, TrainingPeriod[]> = { active: [], upcoming: [], closed: [] };
    for (const p of periods) {
      const key = (STATUS_ORDER as string[]).includes(p.status) ? (p.status as PeriodStatus) : 'closed';
      buckets[key].push(p);
    }
    // Yaklaşan: başlangıç tarihi yakın olan üstte; Kapanmış: yeni kapanan üstte
    buckets.upcoming.sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
    buckets.closed.sort((a, b) => +new Date(b.endDate) - +new Date(a.endDate));
    return buckets;
  }, [periods]);

  const selected = useMemo(() => periods.find((p) => p.id === value) ?? null, [periods, value]);
  const isAll = value === null && includeAll;

  const handleSelect = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={loading || periods.length === 0}
          className="group inline-flex items-stretch gap-3 rounded-2xl border bg-[var(--k-surface,#fff)] px-3 py-2 text-left outline-none transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--k-primary,#0d9668)]/30 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: 'var(--k-border, #c9c4be)', minWidth: 280 }}
        >
          {/* Icon block */}
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: isAll
                ? 'var(--k-surface-hover, #f5f5f4)'
                : selected?.status === 'active'
                  ? 'var(--k-primary-light, #d1fae5)'
                  : selected?.status === 'upcoming'
                    ? 'var(--k-warning-bg, #fef3c7)'
                    : 'var(--k-surface-hover, #f5f5f4)',
              color: isAll
                ? 'var(--k-text-muted, #78716c)'
                : selected?.status === 'active'
                  ? 'var(--k-primary, #0d9668)'
                  : selected?.status === 'upcoming'
                    ? '#92400e'
                    : 'var(--k-text-muted, #78716c)',
            }}
          >
            {isAll ? <Layers size={18} strokeWidth={2.2} /> : <Calendar size={18} strokeWidth={2.2} />}
          </span>

          {/* Body */}
          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--k-text-muted, #78716c)' }}
            >
              Eğitim Dönemi
            </span>
            <span className="flex items-center gap-2">
              <span
                className="truncate text-[15px] font-semibold leading-tight"
                style={{ color: 'var(--k-text-primary, #1c1917)', fontFamily: 'var(--font-display, system-ui)' }}
              >
                {loading
                  ? 'Yükleniyor…'
                  : isAll
                    ? 'Tüm Dönemler'
                    : selected
                      ? `${selected.year} · ${stripYearPrefix(selected.label)}`
                      : 'Dönem seçin'}
              </span>
              {!isAll && selected && <StatusPill status={selected.status} />}
            </span>
            {!isAll && selected && (
              <span className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--k-text-muted, #78716c)' }}>
                {formatRange(selected.startDate, selected.endDate)}
              </span>
            )}
            {isAll && (
              <span className="mt-0.5 text-xs" style={{ color: 'var(--k-text-muted, #78716c)' }}>
                Tüm dönemler birleştirilmiş görünüm
              </span>
            )}
          </span>

          <span className="flex items-center pl-1" style={{ color: 'var(--k-text-muted, #78716c)' }}>
            <ChevronDown
              size={16}
              className="transition-transform duration-150 group-data-[state=open]:rotate-180"
              strokeWidth={2.2}
            />
          </span>
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={8} className="w-[360px] gap-0 p-0">
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--k-border-light, #e7e5e4)' }}
          >
            <div className="flex flex-col">
              <span
                className="text-sm font-semibold leading-tight"
                style={{ color: 'var(--k-text-primary, #1c1917)', fontFamily: 'var(--font-display, system-ui)' }}
              >
                Eğitim Dönemi
              </span>
              <span className="text-[11px]" style={{ color: 'var(--k-text-muted, #78716c)' }}>
                {periods.length} dönem · raporlama ve istatistik filtresi
              </span>
            </div>
          </div>

          {/* Scroll body */}
          <div className="max-h-[420px] overflow-y-auto p-2">
            {includeAll && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="group/item mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150"
                style={{
                  background: isAll ? 'var(--k-primary-light, #d1fae5)' : 'transparent',
                  borderColor: isAll ? 'var(--k-primary, #0d9668)' : 'transparent',
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: isAll ? 'rgba(255,255,255,0.65)' : 'var(--k-surface-hover, #f5f5f4)',
                    color: isAll ? 'var(--k-primary, #0d9668)' : 'var(--k-text-muted, #78716c)',
                  }}
                >
                  <Layers size={16} strokeWidth={2.2} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span
                    className="text-sm font-semibold leading-tight"
                    style={{ color: isAll ? 'var(--k-primary, #0d9668)' : 'var(--k-text-primary, #1c1917)' }}
                  >
                    Tüm Dönemler
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--k-text-muted, #78716c)' }}>
                    Tüm dönemler birleştirilmiş görünüm
                  </span>
                </span>
                {isAll && <Check size={16} strokeWidth={2.5} style={{ color: 'var(--k-primary, #0d9668)' }} />}
              </button>
            )}

            {STATUS_ORDER.map((status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <div key={status} className="mb-1 last:mb-0">
                  <div
                    className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--k-text-muted, #78716c)' }}
                  >
                    {SECTION_LABEL[status]}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {items.map((p) => {
                      const isSelected = !isAll && p.id === value;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelect(p.id)}
                          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--k-surface-hover,#f5f5f4)]"
                          style={{
                            background: isSelected ? 'var(--k-primary-light, #d1fae5)' : 'transparent',
                            borderColor: isSelected ? 'var(--k-primary, #0d9668)' : 'transparent',
                          }}
                        >
                          <span
                            className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-lg tabular-nums"
                            style={{
                              background: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--k-surface-hover, #f5f5f4)',
                              color: isSelected ? 'var(--k-primary, #0d9668)' : 'var(--k-text-secondary, #44403c)',
                              fontFamily: 'var(--font-display, system-ui)',
                            }}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">YIL</span>
                            <span className="text-sm font-bold leading-none">{p.year}</span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center gap-2">
                              <span
                                className="truncate text-sm font-semibold leading-tight"
                                style={{ color: 'var(--k-text-primary, #1c1917)' }}
                              >
                                {stripYearPrefix(p.label)}
                              </span>
                              {p.isDefault && (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                                  style={{
                                    background: 'var(--k-info-bg, #dbeafe)',
                                    color: 'var(--k-info, #3b82f6)',
                                  }}
                                  title="Varsayılan dönem"
                                >
                                  Vars.
                                </span>
                              )}
                            </span>
                            <span
                              className="mt-0.5 text-[11px] tabular-nums"
                              style={{ color: 'var(--k-text-muted, #78716c)' }}
                            >
                              {formatRange(p.startDate, p.endDate)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <StatusPill status={p.status} />
                            {isSelected && (
                              <Check size={16} strokeWidth={2.5} style={{ color: 'var(--k-primary, #0d9668)' }} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!loading && periods.length === 0 && (
              <div
                className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
                style={{ borderColor: 'var(--k-border-light, #e7e5e4)', color: 'var(--k-text-muted, #78716c)' }}
              >
                Henüz tanımlı eğitim dönemi yok. Önce <span className="font-semibold">Eğitim Dönemleri</span> sayfasından bir dönem oluşturun.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
