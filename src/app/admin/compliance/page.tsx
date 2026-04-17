'use client';

import { Fragment, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ShieldCheck, AlertTriangle, Clock, CheckCircle, Building2,
  RefreshCw, Printer, ChevronDown, Send, ExternalLink, Users, UserX,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { printPage } from '@/lib/export';

const ComplianceChart = dynamic(() => import('./compliance-chart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg" style={{ background: 'var(--color-surface)' }} />,
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

const deadlineColors: Record<string, { color: string; bg: string; label: string }> = {
  overdue: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: 'Süresi Geçti' },
  critical: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: 'Kritik' },
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', label: 'Yaklaşıyor' },
  ok: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Uygun' },
};

const statusLabels: Record<string, string> = {
  assigned: 'Başlanmadı',
  in_progress: 'Devam Ediyor',
  failed: 'Başarısız',
  passed: 'Başarılı',
};

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-success)';
  if (rate >= 50) return 'var(--color-warning)';
  return 'var(--color-error)';
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Uyum Raporu" subtitle="Zorunlu eğitimler ve yasal uyum durumu" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="gap-1.5 rounded-lg text-xs"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </Button>
          <Button
            variant="outline" size="sm"
            className="gap-1.5 rounded-lg text-xs"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            onClick={printPage}
          >
            <Printer className="h-3.5 w-3.5" /> Yazdır
          </Button>
        </div>
      </div>

      {!hasAnyTrainings ? (
        <BlurFade delay={0.05}>
          <div
            className="rounded-2xl border-2 border-dashed p-10 text-center"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <ShieldCheck className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--color-text-muted)' }} />
            <h3 className="text-base font-bold">Henüz zorunlu eğitim tanımlanmamış</h3>
            <p className="mt-1 text-sm max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
              Uyum takibi için en az bir eğitimin <strong>Zorunlu</strong> olarak işaretlenmesi gerekir.
              Eğitim oluştururken ya da düzenlerken &quot;Zorunlu&quot; seçeneğini aktif edin.
            </p>
            <Link
              href="/admin/trainings"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' }}
            >
              Eğitimlere git <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </BlurFade>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Denetim Uyumu', value: `%${trueRate}`, icon: ShieldCheck, accentColor: trueRate >= 80 ? 'var(--color-success)' : trueRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)' },
              { title: 'Atama Uyumu', value: `%${overall}`, icon: CheckCircle, accentColor: overall >= 80 ? 'var(--color-success)' : 'var(--color-warning)' },
              { title: 'Zorunlu Eğitim', value: summary?.totalCompulsoryTrainings ?? 0, icon: AlertTriangle, accentColor: 'var(--color-primary)' },
              { title: 'Acil Deadline', value: summary?.urgentDeadlineCount ?? 0, icon: Clock, accentColor: (summary?.urgentDeadlineCount ?? 0) > 0 ? 'var(--color-error)' : 'var(--color-success)' },
            ].map((s, i) => (
              <BlurFade key={s.title} delay={0.05 + i * 0.03}><StatCard {...s} /></BlurFade>
            ))}
          </div>

          {/* Uyum metrik açıklaması */}
          <BlurFade delay={0.12}>
            <div
              className="rounded-xl border px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-2"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <span><Users className="inline h-3.5 w-3.5 mr-1" />Toplam Personel: <strong style={{ color: 'var(--color-text-primary)' }}>{summary?.totalStaff ?? 0}</strong></span>
              <span><UserX className="inline h-3.5 w-3.5 mr-1" />Atanmamış Atama: <strong style={{ color: 'var(--color-error)' }}>{summary?.totalUnassigned ?? 0}</strong></span>
              <span>Tam Uyumlu Eğitim: <strong style={{ color: 'var(--color-success)' }}>{summary?.fullyCompliantTrainings ?? 0}</strong> / {summary?.totalCompulsoryTrainings ?? 0}</span>
              <span>Yaklaşan (30 gün): <strong style={{ color: 'var(--color-warning)' }}>{summary?.warningDeadlineCount ?? 0}</strong></span>
            </div>
          </BlurFade>

          {/* Acil deadline uyarısı */}
          {urgentDeadlines.length > 0 && (
            <BlurFade delay={0.15}>
              <div className="rounded-2xl border p-5" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>Dikkat Gerektiren Eğitimler</h3>
                </div>
                <div className="space-y-2">
                  {urgentDeadlines.map(d => {
                    const cfg = deadlineColors[d.status] ?? deadlineColors.ok;
                    return (
                      <Link
                        key={d.id}
                        href={`/admin/trainings/${d.id}/assignments`}
                        className="flex items-center justify-between rounded-xl px-4 py-2.5 hover:-translate-y-0.5 transition-transform"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                      >
                        <div>
                          <p className="text-sm font-semibold">{d.title}</p>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            Son: {d.deadline?.split('T')[0] ?? '—'}
                            {d.daysLeft !== null && (
                              <span className="ml-2">· {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} gün geçti` : `${d.daysLeft} gün kaldı`}</span>
                            )}
                            {' · '}
                            <span style={{ color: 'var(--color-error)' }}>{d.nonCompliantCount} uyumsuz</span>
                          </p>
                        </div>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </BlurFade>
          )}

          {/* Grafik + Tablo */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <BlurFade delay={0.2}>
              <ChartCard title="Departman Uyumu" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
                <ComplianceChart data={deptCompliance} />
              </ChartCard>
            </BlurFade>

            <BlurFade delay={0.25} className="lg:col-span-2">
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h3 className="text-sm font-bold">Zorunlu Eğitim Durumu</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--color-bg)' }}>
                        {['Eğitim', 'Düzenleyici', 'Son Tarih', 'Durum', 'Başarılı', 'Kalan', 'Atanmamış', 'Uyum %', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trainings.map(t => {
                        const cfg = deadlineColors[t.deadlineStatus] ?? deadlineColors.ok;
                        const isOpen = expandedId === t.id;
                        const remaining = t.stats.failed + t.stats.notStarted + t.stats.inProgress;
                        const canRemind = remaining > 0;
                        return (
                          <Fragment key={t.id}>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(isOpen ? null : t.id)}
                                  className="inline-flex items-center gap-1.5 hover:underline"
                                >
                                  <ChevronDown
                                    className="h-3.5 w-3.5 transition-transform"
                                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                  />
                                  {t.title}
                                </button>
                                {t.category && (
                                  <span className="ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                                    {t.category}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{t.regulatoryBody ?? '—'}</td>
                              <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                                {t.complianceDeadline?.split('T')[0] ?? '—'}
                                {t.renewalPeriodMonths && (
                                  <div className="text-[10px]">{t.renewalPeriodMonths} ay periyot</div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                <span style={{ color: 'var(--color-success)' }}>{t.stats.passed}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}> / {t.stats.totalAssigned}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                {t.stats.failed > 0 && <span style={{ color: 'var(--color-error)' }}>{t.stats.failed}K </span>}
                                {t.stats.inProgress > 0 && <span style={{ color: 'var(--color-warning)' }}>{t.stats.inProgress}D </span>}
                                {t.stats.notStarted > 0 && <span style={{ color: 'var(--color-text-muted)' }}>{t.stats.notStarted}B</span>}
                                {remaining === 0 && <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                                {t.stats.unassigned > 0
                                  ? <span style={{ color: 'var(--color-error)' }}>{t.stats.unassigned}</span>
                                  : <span style={{ color: 'var(--color-text-muted)' }}>0</span>}
                              </td>
                              <td className="px-4 py-3 min-w-35">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 rounded-full" style={{ background: 'var(--color-bg)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${t.stats.trueComplianceRate}%`, background: rateColor(t.stats.trueComplianceRate) }} />
                                  </div>
                                  <span className="text-xs font-bold font-mono" style={{ color: rateColor(t.stats.trueComplianceRate) }}>
                                    %{t.stats.trueComplianceRate}
                                  </span>
                                </div>
                                {t.stats.complianceRate !== t.stats.trueComplianceRate && (
                                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    atamada %{t.stats.complianceRate}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="outline" size="sm"
                                    className="gap-1 rounded-lg text-[11px] h-7 px-2"
                                    disabled={!canRemind || remindingId === t.id}
                                    onClick={() => handleRemind(t.id, t.title)}
                                    title={canRemind ? 'Tamamlamayanlara hatırlatma gönder' : 'Hatırlatılacak kişi yok'}
                                  >
                                    <Send className="h-3 w-3" />
                                    {remindingId === t.id ? '...' : 'Hatırlat'}
                                  </Button>
                                  <Link
                                    href={`/admin/trainings/${t.id}/assignments`}
                                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] h-7"
                                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                                    title="Atamaları göster"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              </td>
                            </tr>

                            {isOpen && (
                              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                                <td colSpan={9} className="px-6 py-4">
                                  {t.nonCompliantStaff.length === 0 ? (
                                    <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                                      Tamamlamayan personel yok — bu eğitim için tam uyum sağlandı.
                                    </p>
                                  ) : (
                                    <div>
                                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                        Tamamlamayan Personel ({t.nonCompliantStaff.length}
                                        {t.stats.totalAssigned - t.stats.passed > t.nonCompliantStaff.length
                                          ? ` / ${t.stats.totalAssigned - t.stats.passed}` : ''})
                                      </p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {t.nonCompliantStaff.map(s => (
                                          <div
                                            key={s.id}
                                            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                                          >
                                            <div className="min-w-0">
                                              <p className="font-semibold truncate">{s.name}</p>
                                              <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
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
