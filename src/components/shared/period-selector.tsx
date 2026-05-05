'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { periodStatusLabel } from '@/lib/training-periods';
import type { TrainingPeriod } from '@/types/database';

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

export function PeriodSelector({
  value,
  onChange,
  includeAll = false,
  className,
}: PeriodSelectorProps) {
  const [periods, setPeriods] = useState<TrainingPeriod[]>([]);
  const [loading, setLoading] = useState(true);

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

  const selectValue = useMemo(() => {
    if (value === null) return includeAll ? ALL_VALUE : '';
    return value;
  }, [value, includeAll]);

  const triggerLabel = useMemo(() => {
    if (loading) return 'Yükleniyor…';
    if (selectValue === ALL_VALUE) return 'Tüm Dönemler';
    const found = periods.find((p) => p.id === selectValue);
    if (!found) return 'Dönem seçin';
    return `${found.year} ${found.label.replace(/^\d{4}\s*/, '')} (${periodStatusLabel(found.status)})`;
  }, [loading, selectValue, periods]);

  return (
    <div className={className}>
      <Select
        value={selectValue || undefined}
        onValueChange={(v) => {
          if (v === ALL_VALUE) onChange(null);
          else onChange(v ?? null);
        }}
        disabled={loading || periods.length === 0}
      >
        <SelectTrigger
          className="h-10 min-w-[220px] gap-2 rounded-xl px-3 text-sm font-medium"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <Calendar className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <SelectValue placeholder={loading ? 'Yükleniyor…' : 'Dönem seçin'}>
            {triggerLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {includeAll && (
            <SelectItem value={ALL_VALUE}>
              <span className="font-semibold">Tüm Dönemler</span>
            </SelectItem>
          )}
          {periods.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-mono font-semibold">{p.year}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {p.label.replace(/^\d{4}\s*/, '') || 'Eğitim Dönemi'}
              </span>
              <span
                className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background:
                    p.status === 'active'
                      ? 'var(--color-primary-light)'
                      : p.status === 'upcoming'
                        ? 'var(--color-warning-bg)'
                        : 'var(--color-surface-hover)',
                  color:
                    p.status === 'active'
                      ? 'var(--color-primary)'
                      : p.status === 'upcoming'
                        ? '#92400e'
                        : 'var(--color-text-muted)',
                }}
              >
                {periodStatusLabel(p.status)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
