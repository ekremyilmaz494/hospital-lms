'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  ChevronRight,
  Eye,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { PageLoading } from '@/components/shared/page-loading';
import { KStatCard } from '@/components/admin/k-stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { periodStatusLabel } from '@/lib/training-periods-helpers';
import type { PeriodStatus, TrainingPeriod } from '@/types/database';
import { NewPeriodModal } from './_components/new-period-modal';

interface PeriodRow extends TrainingPeriod {
  _count?: { assignments: number };
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function statusVisual(status: PeriodStatus) {
  switch (status) {
    case 'active':
      return {
        bg: 'var(--color-primary-light)',
        fg: 'var(--color-primary)',
        dot: 'var(--color-primary)',
      };
    case 'upcoming':
      return {
        bg: 'var(--color-warning-bg)',
        fg: '#92400e',
        dot: 'var(--color-warning)',
      };
    case 'closed':
      return {
        bg: 'var(--color-surface-hover)',
        fg: 'var(--color-text-muted)',
        dot: 'var(--color-text-muted)',
      };
  }
}

export default function TrainingPeriodsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showNewModal, setShowNewModal] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useFetch<PeriodRow[]>('/api/admin/training-periods');

  const periods = useMemo<PeriodRow[]>(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const active = periods.find((p) => p.status === 'active') ?? null;
    const closed = periods.filter((p) => p.status === 'closed').length;
    return {
      active,
      total: periods.length,
      closed,
    };
  }, [periods]);

  const handleClose = async (period: PeriodRow) => {
    if (closingId) return;
    if (
      !window.confirm(
        `"${period.label}" dönemini kapatmak üzeresiniz. Bu işlem geri alınamaz. Devam edilsin mi?`,
      )
    ) {
      return;
    }
    setClosingId(period.id);
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
      setClosingId(null);
    }
  };

  const handleDelete = async (period: PeriodRow) => {
    if (deletingId) return;
    if (!window.confirm(`"${period.label}" dönemini silmek istediğinize emin misiniz?`)) return;
    setDeletingId(period.id);
    try {
      const res = await fetch(`/api/admin/training-periods/${period.id}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Dönem silinemedi');
      toast('Dönem silindi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dönem silinemedi', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading && periods.length === 0) {
    return <PageLoading />;
  }

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Eğitim Dönemleri</span>
          </div>
          <h1 className="k-page-title">Eğitim Dönemleri</h1>
          <p className="k-page-subtitle">
            Yıllık eğitim dönemlerini açın, kapatın ve atama özetlerini takip edin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
              boxShadow: '0 4px 14px rgba(var(--color-primary-rgb), 0.3)',
              transitionProperty: 'transform, box-shadow',
            }}
          >
            <Plus className="h-4 w-4" />
            Yeni Dönem Aç
          </button>
        </div>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BlurFade delay={0}>
          <KStatCard
            title="Aktif Dönem"
            value={stats.active ? String(stats.active.year) : 'Yok'}
            icon={CalendarCheck}
            accentColor="var(--color-primary)"
          />
        </BlurFade>
        <BlurFade delay={0.05}>
          <KStatCard
            title="Toplam Dönem"
            value={stats.total}
            icon={Calendar}
            accentColor="var(--color-info)"
          />
        </BlurFade>
        <BlurFade delay={0.1}>
          <KStatCard
            title="Kapanmış Dönem"
            value={stats.closed}
            icon={CalendarOff}
            accentColor="var(--color-text-muted)"
          />
        </BlurFade>
      </section>

      {/* List */}
      {periods.length === 0 ? (
        <BlurFade delay={0.1}>
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-20 px-6 text-center"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <CalendarClock className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Henüz eğitim dönemi yok
              </h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Personel atamalarını bir döneme bağlamak için yeni dönem oluşturun.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              <Plus className="h-4 w-4" />
              İlk Dönemi Aç
            </button>
          </div>
        </BlurFade>
      ) : (
        <BlurFade delay={0.1}>
          <div
            className="overflow-x-auto rounded-2xl border"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-hover)' }}>
                  {['Yıl', 'Etiket', 'Tarih Aralığı', 'Durum', 'Atama', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const v = statusVisual(p.status);
                  const assignments = p._count?.assignments ?? 0;
                  const canDelete = p.status === 'upcoming' && assignments === 0;
                  const canClose = p.status === 'active';
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/admin/training-periods/${p.id}`)}
                      className="cursor-pointer hover:bg-black/[0.02]"
                      style={{
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      <td className="px-4 py-4 text-sm font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                        {p.year}
                        {p.isDefault && (
                          <span
                            className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
                          >
                            Varsayılan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {p.label}
                      </td>
                      <td className="px-4 py-4 text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDate(p.startDate)} – {formatDate(p.endDate)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ background: v.bg, color: v.fg }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
                          {periodStatusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {assignments}
                      </td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/training-periods/${p.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                            style={{
                              background: 'var(--color-surface-hover)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Detay
                          </Link>
                          {canClose && (
                            <button
                              type="button"
                              onClick={() => handleClose(p)}
                              disabled={closingId === p.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                              style={{
                                background: 'var(--color-warning-bg)',
                                color: '#92400e',
                              }}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              {closingId === p.id ? 'Kapatılıyor…' : 'Kapat'}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={deletingId === p.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                              style={{
                                background: 'var(--color-error-bg)',
                                color: 'var(--color-error)',
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingId === p.id ? 'Siliniyor…' : 'Sil'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BlurFade>
      )}

      <NewPeriodModal open={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  );
}
