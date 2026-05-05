'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit,
  Loader2,
  Lock,
  XCircle,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { PageLoading } from '@/components/shared/page-loading';
import { KStatCard } from '@/components/admin/k-stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { periodStatusLabel } from '@/lib/training-periods-helpers';
import type { PeriodStatus, TrainingPeriod } from '@/types/database';

interface PeriodDetail extends TrainingPeriod {
  _count: { assignments: number };
  /** API tarafından opsiyonel olarak dönebilecek breakdown — yoksa toplamdan türetilir */
  assignmentBreakdown?: {
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function statusVisual(status: PeriodStatus) {
  switch (status) {
    case 'active':
      return { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)', dot: 'var(--color-primary)' };
    case 'upcoming':
      return { bg: 'var(--color-warning-bg)', fg: '#92400e', dot: 'var(--color-warning)' };
    case 'closed':
      return { bg: 'var(--color-surface-hover)', fg: 'var(--color-text-muted)', dot: 'var(--color-text-muted)' };
  }
}

export default function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);

  const { data: period, isLoading, refetch } = useFetch<PeriodDetail>(
    `/api/admin/training-periods/${id}`,
  );

  const handleClose = async () => {
    if (!period) return;
    if (
      !window.confirm(
        `"${period.label}" dönemini kapatmak üzeresiniz. Bu işlem geri alınamaz. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/training-periods/${period.id}/close`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Dönem kapatılamadı');
      toast(`${period.label} kapatıldı`, 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dönem kapatılamadı', 'error');
    } finally {
      setClosing(false);
    }
  };

  if (isLoading && !period) return <PageLoading />;

  if (!period) {
    return (
      <div className="k-page">
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Eğitim dönemi bulunamadı
          </p>
          <Link
            href="/admin/training-periods"
            className="mt-4 inline-flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowLeft className="h-4 w-4" /> Eğitim Dönemleri
          </Link>
        </div>
      </div>
    );
  }

  const v = statusVisual(period.status);
  const total = period._count?.assignments ?? 0;
  const breakdown = period.assignmentBreakdown ?? {
    completed: 0,
    inProgress: 0,
    pending: total,
    failed: 0,
  };

  return (
    <div className="k-page">
      <Link
        href="/admin/training-periods"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Eğitim Dönemleri
      </Link>

      <header className="k-page-header">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="k-page-title">{period.label}</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: v.bg, color: v.fg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
              {periodStatusLabel(period.status)}
            </span>
          </div>
          <p className="k-page-subtitle">
            {formatDate(period.startDate)} – {formatDate(period.endDate)}
            {period.closedAt && (
              <>
                {' · '}Kapanış: <strong>{formatDate(period.closedAt)}</strong>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {period.status === 'upcoming' && (
            <button
              type="button"
              onClick={() => router.push(`/admin/training-periods/${period.id}/edit`)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-surface)',
              }}
            >
              <Edit className="h-4 w-4" />
              Düzenle
            </button>
          )}
          {period.status === 'active' && (
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--color-warning)' }}
            >
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {closing ? 'Kapatılıyor…' : 'Dönemi Kapat'}
            </button>
          )}
        </div>
      </header>

      {/* Period info grid */}
      <BlurFade delay={0}>
        <div
          className="grid grid-cols-1 gap-0 overflow-hidden rounded-2xl border md:grid-cols-4"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {[
            { label: 'Yıl', value: String(period.year), icon: Calendar },
            { label: 'Etiket', value: period.label, icon: ClipboardList },
            { label: 'Başlangıç', value: formatDate(period.startDate), icon: Clock },
            { label: 'Bitiş', value: formatDate(period.endDate), icon: Clock },
          ].map((cell, idx) => {
            const Icon = cell.icon;
            return (
              <div
                key={idx}
                className="flex flex-col gap-2 p-5"
                style={{
                  borderRight:
                    idx < 3 ? '1px solid var(--color-border)' : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {cell.label}
                  </span>
                </div>
                <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {cell.value}
                </span>
              </div>
            );
          })}
        </div>
      </BlurFade>

      {/* Assignment summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BlurFade delay={0}>
          <KStatCard
            title="Toplam Atama"
            value={total}
            icon={ClipboardList}
            accentColor="var(--color-primary)"
          />
        </BlurFade>
        <BlurFade delay={0.05}>
          <KStatCard
            title="Tamamlanan"
            value={breakdown.completed}
            icon={CheckCircle2}
            accentColor="var(--color-success)"
          />
        </BlurFade>
        <BlurFade delay={0.1}>
          <KStatCard
            title="Devam Eden"
            value={breakdown.inProgress + breakdown.pending}
            icon={Clock}
            accentColor="var(--color-warning)"
          />
        </BlurFade>
        <BlurFade delay={0.15}>
          <KStatCard
            title="Başarısız"
            value={breakdown.failed}
            icon={XCircle}
            accentColor="var(--color-error)"
          />
        </BlurFade>
      </section>
    </div>
  );
}
