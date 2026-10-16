'use client';

import { Fragment, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle, Building2,
  RefreshCw, Printer, ChevronDown, Send, ExternalLink, Users, UserX, ChevronRight,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { KStatCard } from '@/components/admin/k-stat-card';
import { KChartCard } from '@/components/admin/k-chart-card';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { printPage } from '@/lib/export';

const ComplianceChart = dynamic(() => import('./compliance-chart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg" style={{ background: 'var(--k-surface-hover)' }} />,
});

interface NonCompliantStaff {
  id: string;
  name: string;
  email: string;
  department: string;
  status: string;
  lastScore: number | null;
}

interface TrainingComp {
  id: string;
  title: string;
  category: string | null;
  regulatoryBody: string | null;
  complianceDeadline: string | null;
  renewalPeriodMonths: number | null;
  deadlineStatus: string;
  daysLeft: number | null;
  stats: {
    totalAssigned: number;
    passed: number;
    failed: number;
    notStarted: number;
    inProgress: number;
    unassigned: number;
    complianceRate: number;
    trueComplianceRate: number;
  };
  nonCompliantStaff: NonCompliantStaff[];
}

interface DeptComp {
  dept: string;
  total: number;
  passed: number;
  rate: number;
  riskLevel: 'high' | 'medium' | 'low';
}

interface CompData {
  summary: {
    totalCompulsoryTrainings: number;
    fullyCompliantTrainings: number;
    overallComplianceRate: number;
    trueComplianceRate: number;
    totalStaff: number;
    urgentDeadlineCount: number;
    warningDeadlineCount: number;
    totalUnassigned: number;
  };
  trainingCompliance: TrainingComp[];
  urgentDeadlines: {
    id: string;
    title: string;
    deadline: string | null;
    daysLeft: number | null;
    status: string;
    complianceRate: number;
    trueComplianceRate: number;
    nonCompliantCount: number;
  }[];
  departmentCompliance: DeptComp[];
}

const deadlineBadgeClass: Record<string, string> = {
  overdue: 'k-badge-error',
  critical: 'k-badge-error',
  warning: 'k-badge-warning',
  ok: 'k-badge-success',
};

const deadlineLabel: Record<string, string> = {
  overdue: 'Süresi Geçti',
  critical: 'Kritik',
  warning: 'Yaklaşıyor',
  ok: 'Uygun',
};

const statusLabels: Record<string, string> = {
  assigned: 'Başlanmadı',
  in_progress: 'Devam Ediyor',
  failed: 'Başarısız',
  passed: 'Başarılı',
};

function rateVariant(rate: number): 'success' | 'warning' | 'error' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'error';
}

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--k-success)';
  if (rate >= 50) return 'var(--k-warning)';
  return 'var(--k-error)';
}

export default function CompliancePage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useFetch<CompData>('/api/admin/compliance');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const handleRemind = useCallback(async (trainingId: string, title: string) => {
    setRemindingId(trainingId);
    try {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? 'Hatırlatma gönderilemedi');
      }
      toast(
        `"${title}" için ${body?.emailsSent ?? 0} e-posta, ${body?.notificationsSent ?? 0} bildirim gönderildi.`,
        'success',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hatırlatma gönderilemedi', 'error');
    } finally {
      setRemindingId(null);
    }
  }, [toast]);

  if (isLoading) return <PageLoading />;

  const summary = data?.summary;
  const trainings = data?.trainingCompliance ?? [];
  const urgentDeadlines = data?.urgentDeadlines ?? [];
  const deptCompliance = data?.departmentCompliance ?? [];

  const hasAnyTrainings = trainings.length > 0;
  const overall = summary?.overallComplianceRate ?? 0;
  const trueRate = summary?.trueComplianceRate ?? 0;

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Uyum Raporu</span>
          </div>
          <h1 className="k-page-title">Uyum Raporu</h1>
          <p className="k-page-subtitle">
            Zorunlu eğitimler · genel uyum oranı{' '}
            <strong style={{ color: rateColor(overall) }}>%{overall}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="k-btn k-btn-ghost k-btn-sm">
            <RefreshCw size={13} /> Yenile
          </button>
          <button onClick={printPage} className="k-btn k-btn-ghost k-btn-sm">
            <Printer size={13} /> Yazdır
          </button>
        </div>
      </header>

      {!hasAnyTrainings ? (
        <BlurFade delay={0.05}>
          <div
            className="rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
          >
            <ShieldCheck className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--k-text-muted)' }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--k-text-primary)' }}>
              Henüz zorunlu eğitim tanımlanmamış
            </h3>
            <p className="mt-1 text-sm max-w-md mx-auto" style={{ color: 'var(--k-text-muted)' }}>
              Uyum takibi için en az bir eğitimin <strong>Zorunlu</strong> olarak işaretlenmesi gerekir.
              Eğitim oluştururken ya da düzenlerken &quot;Zorunlu&quot; seçeneğini aktif edin.
            </p>
            <Link href="/admin/trainings" className="k-btn k-btn-primary mt-4 inline-flex">
              Eğitimlere git <ExternalLink size={14} />
            </Link>
          </div>
        </BlurFade>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BlurFade delay={0.05}>
              <KStatCard
                title="Denetim Uyumu"
                value={`%${trueRate}`}
                icon={ShieldCheck}
                accentColor={rateColor(trueRate)}
              />
            </BlurFade>
            <BlurFade delay={0.08}>
              <KStatCard
                title="Atama Uyumu"
                value={`%${overall}`}
                icon={CheckCircle}
                accentColor={overall >= 80 ? 'var(--k-success)' : 'var(--k-warning)'}
              />
            </BlurFade>
            <BlurFade delay={0.11}>
              <KStatCard
                title="Zorunlu Eğitim"
                value={summary?.totalCompulsoryTrainings ?? 0}
                icon={AlertTriangle}
                accentColor="var(--k-primary)"
              />
            </BlurFade>
            <BlurFade delay={0.14}>
              <KStatCard
                title="Acil Deadline"
                value={summary?.urgentDeadlineCount ?? 0}
                icon={Clock}
                accentColor={(summary?.urgentDeadlineCount ?? 0) > 0 ? 'var(--k-error)' : 'var(--k-success)'}
              />
            </BlurFade>
          </div>

          {/* Uyum metrik açıklaması */}
          <BlurFade delay={0.17}>
            <div
              className="rounded-xl border px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-2"
              style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)', color: 'var(--k-text-muted)' }}
            >
              <span>
                <Users className="inline h-3.5 w-3.5 mr-1" />
                Toplam Personel: <strong style={{ color: 'var(--k-text-primary)' }}>{summary?.totalStaff ?? 0}</strong>
              </span>
              <span>
                <UserX className="inline h-3.5 w-3.5 mr-1" />
                Atanmamış Atama: <strong style={{ color: 'var(--k-error)' }}>{summary?.totalUnassigned ?? 0}</strong>
              </span>
              <span>
                Tam Uyumlu Eğitim: <strong style={{ color: 'var(--k-success)' }}>{summary?.fullyCompliantTrainings ?? 0}</strong> / {summary?.totalCompulsoryTrainings ?? 0}
              </span>
              <span>
                Yaklaşan (30 gün): <strong style={{ color: 'var(--k-warning)' }}>{summary?.warningDeadlineCount ?? 0}</strong>
              </span>
            </div>
          </BlurFade>

          {/* Acil deadline uyarısı */}
          {urgentDeadlines.length > 0 && (
            <BlurFade delay={0.2}>
              <div
                className="k-card"
                style={{
                  background: 'var(--k-error-bg)',
                  borderColor: 'var(--k-error)',
                  borderLeftWidth: '4px',
                }}
              >
                <div className="k-card-body">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} style={{ color: 'var(--k-error)' }} />
                    <h3 className="text-sm font-bold" style={{ color: 'var(--k-error)' }}>
                      Dikkat Gerektiren Eğitimler
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {urgentDeadlines.map(d => {
                      const badgeCls = deadlineBadgeClass[d.status] ?? 'k-badge-success';
                      const label = deadlineLabel[d.status] ?? 'Uygun';
                      return (
                        <Link
                          key={d.id}
                          href={`/admin/trainings/${d.id}`}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5 hover:-translate-y-0.5"
                          style={{
                            background: 'var(--k-surface)',
                            border: '1px solid var(--k-border)',
                            transition: 'transform 200ms ease, border-color 200ms ease',
                          }}
                        >
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--k-text-primary)' }}>{d.title}</p>
                            <p className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                              Son: {d.deadline?.split('T')[0] ?? '—'}
                              {d.daysLeft !== null && (
                                <span className="ml-2">
                                  · {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} gün geçti` : `${d.daysLeft} gün kaldı`}
                                </span>
                              )}
                              {' · '}
                              <span style={{ color: 'var(--k-error)' }}>{d.nonCompliantCount} uyumsuz</span>
                            </p>
                          </div>
                          <span className={`k-badge ${badgeCls}`}>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </BlurFade>
          )}

          {/* Grafik + Tablo */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BlurFade delay={0.23}>
              <KChartCard
                title="Departman Uyumu"
                icon={<Building2 size={14} />}
              >
                <ComplianceChart data={deptCompliance} />
              </KChartCard>
            </BlurFade>

            <BlurFade delay={0.26} className="lg:col-span-2">
              <div className="k-card">
                <div className="k-card-head">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--k-text-primary)' }}>
                    Zorunlu Eğitim Durumu
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--k-surface-hover)' }}>
                        {['Eğitim', 'Son Tarih', 'Durum', 'Personel Durumu', 'Uyum', ''].map((h, i) => (
                          <th
                            key={h || `col-${i}`}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase whitespace-nowrap"
                            style={{ color: 'var(--k-text-muted)', letterSpacing: '0.04em' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trainings.map(t => {
                        const badgeCls = deadlineBadgeClass[t.deadlineStatus] ?? 'k-badge-success';
                        const label = deadlineLabel[t.deadlineStatus] ?? 'Uygun';
                        const isOpen = expandedId === t.id;
                        const remaining = t.stats.failed + t.stats.notStarted + t.stats.inProgress;
                        const canRemind = remaining > 0;
                        const variant = rateVariant(t.stats.trueComplianceRate);
                        return (
                          <Fragment key={t.id}>
                            <tr style={{ borderBottom: '1px solid var(--k-border)' }}>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(isOpen ? null : t.id)}
                                  className="inline-flex items-center gap-1.5 font-semibold hover:underline text-left"
                                  style={{ color: 'var(--k-text-primary)' }}
                                >
                                  <ChevronDown
                                    size={14}
                                    className="shrink-0"
                                    style={{
                                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                      transition: 'transform 200ms ease',
                                    }}
                                  />
                                  <span>{t.title}</span>
                                </button>
                                {(t.category || t.regulatoryBody) && (
                                  <div className="mt-1 ml-5 flex flex-wrap items-center gap-1.5">
                                    {t.category && (
                                      <span className="k-badge k-badge-info k-badge-no-dot" style={{ height: 18, fontSize: 10, padding: '0 7px' }}>
                                        {t.category}
                                      </span>
                                    )}
                                    {t.regulatoryBody && (
                                      <span className="k-badge k-badge-muted k-badge-no-dot" style={{ height: 18, fontSize: 10, padding: '0 7px' }}>
                                        {t.regulatoryBody}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--k-text-muted)' }}>
                                <div className="font-mono">{t.complianceDeadline?.split('T')[0] ?? '—'}</div>
                                {t.daysLeft !== null && (
                                  <div
                                    className="text-[10px] mt-0.5"
                                    style={{
                                      color:
                                        t.daysLeft < 0
                                          ? 'var(--k-error)'
                                          : t.daysLeft <= 30
                                            ? 'var(--k-warning)'
                                            : 'var(--k-text-muted)',
                                    }}
                                  >
                                    {t.daysLeft < 0 ? `${Math.abs(t.daysLeft)} gün geçti` : `${t.daysLeft} gün kaldı`}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`k-badge ${badgeCls}`}>{label}</span>
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                <div>
                                  <span className="font-bold" style={{ color: 'var(--k-success)' }}>{t.stats.passed}</span>
                                  <span style={{ color: 'var(--k-text-muted)' }}> / {t.stats.totalAssigned} tamamladı</span>
                                </div>
                                {remaining > 0 && (
                                  <div className="text-[10px] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                    {t.stats.inProgress > 0 && <span style={{ color: 'var(--k-warning)' }}>{t.stats.inProgress} devam</span>}
                                    {t.stats.notStarted > 0 && <span style={{ color: 'var(--k-text-muted)' }}>{t.stats.notStarted} başlamadı</span>}
                                    {t.stats.failed > 0 && <span style={{ color: 'var(--k-error)' }}>{t.stats.failed} başarısız</span>}
                                  </div>
                                )}
                                {t.stats.unassigned > 0 && (
                                  <div className="text-[10px] mt-0.5 font-bold" style={{ color: 'var(--k-error)' }}>
                                    {t.stats.unassigned} kişiye atanmamış
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 min-w-35">
                                <div className="flex items-center gap-2">
                                  <div className="k-progress flex-1">
                                    <div
                                      className="k-progress-fill"
                                      data-variant={variant}
                                      style={{ width: `${t.stats.trueComplianceRate}%` }}
                                    />
                                  </div>
                                  <span
                                    className="text-xs font-bold font-mono"
                                    style={{ color: rateColor(t.stats.trueComplianceRate) }}
                                  >
                                    %{t.stats.trueComplianceRate}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="k-btn k-btn-ghost k-btn-sm"
                                    disabled={!canRemind || remindingId === t.id}
                                    onClick={() => handleRemind(t.id, t.title)}
                                    title={canRemind ? 'Tamamlamayanlara hatırlatma gönder' : 'Hatırlatılacak kişi yok'}
                                  >
                                    <Send size={12} />
                                    {remindingId === t.id ? '...' : 'Hatırlat'}
                                  </button>
                                  <Link
                                    href={`/admin/trainings/${t.id}`}
                                    className="k-btn k-btn-ghost k-btn-sm"
                                    title="Atamaları göster"
                                  >
                                    <ExternalLink size={12} />
                                  </Link>
                                </div>
                              </td>
                            </tr>

                            {isOpen && (
                              <tr
                                style={{
                                  borderBottom: '1px solid var(--k-border)',
                                  background: 'var(--k-surface-hover)',
                                }}
                              >
                                <td colSpan={6} className="px-6 py-4">
                                  {t.nonCompliantStaff.length === 0 ? (
                                    <p className="text-xs text-center" style={{ color: 'var(--k-text-muted)' }}>
                                      Tamamlamayan personel yok — bu eğitim için tam uyum sağlandı.
                                    </p>
                                  ) : (
                                    <div>
                                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--k-text-muted)' }}>
                                        Tamamlamayan Personel ({t.nonCompliantStaff.length}
                                        {t.stats.totalAssigned - t.stats.passed > t.nonCompliantStaff.length
                                          ? ` / ${t.stats.totalAssigned - t.stats.passed}` : ''})
                                      </p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {t.nonCompliantStaff.map(s => (
                                          <div
                                            key={s.id}
                                            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                                            style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}
                                          >
                                            <div className="min-w-0">
                                              <p className="font-semibold truncate" style={{ color: 'var(--k-text-primary)' }}>{s.name}</p>
                                              <p className="text-[10px] truncate" style={{ color: 'var(--k-text-muted)' }}>
                                                {s.department || '—'} · {statusLabels[s.status] ?? s.status}
                                                {s.lastScore !== null && ` · son puan ${s.lastScore}`}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </BlurFade>
          </div>
        </>
      )}
    </div>
  );
}
