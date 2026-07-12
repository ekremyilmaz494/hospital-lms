'use client';

import { useState } from 'react';
import { BarChart3, Download, FileText, Building2, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Hospital {
  id: string;
  name: string;
  code: string;
  staffCount: number;
  activeTrainingCount: number;
  completionRate: number;
  overdueCount: number;
  complianceRate: number | null;
}

interface GroupDashboard {
  groupName: string;
  hospitalCount: number;
  totals: {
    totalStaff: number;
    totalActiveStaff: number;
    totalActiveTrainings: number;
    completionRate: number;
    totalOverdue: number;
    complianceRate: number | null;
  };
  hospitals: Hospital[];
}

function rateColor(rate: number): string {
  if (rate >= 80) return 'var(--color-success)';
  if (rate >= 60) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export default function GroupReportsPage() {
  const { data, isLoading, error } = useFetch<GroupDashboard>('/api/group/dashboard');
  const { toast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format);
    try {
      const params = new URLSearchParams({ format });
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
      const res = await fetch(`/api/group/reports/export?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? 'Dışa aktarma başarısız');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grup-konsolide-rapor-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${format.toUpperCase()} raporu indirildi`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dışa aktarma başarısız', 'error');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error || !data)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error ?? 'Veri yüklenemedi'}</div>
      </div>
    );

  const t = data.totals;

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader title="Konsolide Raporlar" subtitle="Tüm hastaneleri kapsayan birleşik Excel / PDF raporu indirin" />
      </BlurFade>

      {/* Export kartı */}
      <BlurFade delay={0.03}>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-bg, #ecfdf5)' }}>
              <BarChart3 className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold">Birleşik Dışa Aktarma</h3>
              <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                {data.hospitalCount} hastane · her hastane için ayrı sayfa + grup özeti
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Calendar className="h-3 w-3" /> Başlangıç
              </label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined}
                className="rounded-lg border px-3 py-1.5 text-[13px]" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Calendar className="h-3 w-3" /> Bitiş
              </label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined}
                className="rounded-lg border px-3 py-1.5 text-[13px]" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div className="flex-1" />
            <button onClick={() => handleExport('xlsx')} disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--color-primary)' }}>
              <Download className="h-4 w-4" /> {downloading === 'xlsx' ? 'İndiriliyor…' : 'Excel'}
            </button>
            <button onClick={() => handleExport('pdf')} disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <FileText className="h-4 w-4" /> {downloading === 'pdf' ? 'İndiriliyor…' : 'PDF'}
            </button>
          </div>
          {(from || to) && (
            <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Tarih aralığı tüm hastanelere uygulanır. Boş bırakılırsa her hastane kendi aktif dönemini kullanır.
            </p>
          )}
        </div>
      </BlurFade>

      {/* Önizleme — rapora girecek hastaneler */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-[14px] font-bold">Rapora Girecek Hastaneler</h3>
            </div>
            <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>Grup geneli %{t.completionRate} tamamlanma</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left font-semibold px-5 py-2.5">Hastane</th>
                  <th className="text-right font-semibold px-3 py-2.5">Personel</th>
                  <th className="text-right font-semibold px-3 py-2.5">Aktif Eğitim</th>
                  <th className="text-right font-semibold px-5 py-2.5">Tamamlanma</th>
                </tr>
              </thead>
              <tbody>
                {data.hospitals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center" style={{ color: 'var(--color-text-muted)' }}>
                      Bu gruba henüz hastane bağlanmadı.
                    </td>
                  </tr>
                ) : (
                  data.hospitals.map((h) => (
                    <tr key={h.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{h.name}</span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>{h.code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{h.staffCount}</td>
                      <td className="px-3 py-3 text-right font-mono">{h.activeTrainingCount}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold" style={{ color: rateColor(h.completionRate) }}>%{h.completionRate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
