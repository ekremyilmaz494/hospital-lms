'use client';

import { useState } from 'react';
import { Download, Printer, ChevronDown, ChevronRight, FileCheck2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Button } from '@/components/ui/button';
import { exportExcel } from '@/lib/export';

interface Period {
  id: string;
  name: string;
}

interface UnvanSummary {
  unvan: string;
  total: number;
  compliant: number;
  rate: number;
}
interface DeptSummary {
  department: string;
  total: number;
  compliant: number;
  rate: number;
}

interface ActivityItem {
  title: string;
  categoryName: string;
  provider: string | null;
  completionDate: string;
  smgPoints: number;
  approvedAt: string | null;
}

interface StaffDetail {
  userId: string;
  name: string;
  unvan: string | null;
  department: string | null;
  earnedPoints: number;
  requiredPoints: number;
  progress: number;
  isCompliant: boolean;
  activities: ActivityItem[];
}

interface InspectionReportData {
  generatedAt: string;
  period: { name: string; startDate: string; endDate: string } | null;
  organizationName: string;
  summary: {
    totalStaff: number;
    compliantStaff: number;
    complianceRate: number;
    pendingApprovals: number;
    byUnvan: UnvanSummary[];
    byDepartment: DeptSummary[];
  };
  staffDetail: StaffDetail[];
}

interface Props {
  periods: Period[];
}

function rateColor(rate: number) {
  if (rate >= 100) return { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' };
  if (rate >= 50) return { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' };
  return { bg: 'var(--color-error-bg)', fg: 'var(--color-error)' };
}

export function InspectionReportTab({ periods }: Props) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const url = periodId ? `/api/admin/smg/inspection-report?periodId=${periodId}` : '/api/admin/smg/inspection-report';
  const { data, isLoading } = useFetch<InspectionReportData>(url);

  const toggleRow = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportExcel = () => {
    if (!data) return;
    exportExcel({
      headers: ['Ad Soyad', 'Unvan', 'Departman', 'Kazanılan', 'Hedef', 'İlerleme %', 'Durum'],
      rows: data.staffDetail.map(s => [
        s.name,
        s.unvan ?? '-',
        s.department ?? '-',
        s.earnedPoints,
        s.requiredPoints,
        s.progress,
        s.isCompliant ? 'Uyumlu' : 'Yetersiz',
      ]),
      filename: `SKS-Denetim-Raporu-${new Date().toISOString().slice(0, 10)}`,
    });
  };

  if (isLoading && !data) {
    return <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Rapor hazırlanıyor...</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Rapor verisi alınamadı.</div>;
  }

  const { summary, staffDetail, period, organizationName, generatedAt } = data;
  const rateC = rateColor(summary.complianceRate);

  return (
    <div className="p-4 space-y-6 print:p-0">
      {/* Filtre & export */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Dönem:</label>
        <select
          value={periodId}
          onChange={e => setPeriodId(e.target.value)}
          className="text-sm rounded-xl px-3 py-1.5 border outline-none"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          <option value="">Aktif Dönem</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="gap-1.5 rounded-xl">
            <Download className="h-4 w-4" /> Excel İndir
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-1.5 rounded-xl">
            <Printer className="h-4 w-4" /> Yazdır
          </Button>
        </div>
      </div>

      {/* Rapor Başlığı (print için) */}
      <div className="text-center border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <FileCheck2 className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>SKS Denetim Raporu</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{organizationName}</p>
        {period && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {period.name} · {new Date(period.startDate).toLocaleDateString('tr-TR')} — {new Date(period.endDate).toLocaleDateString('tr-TR')}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Rapor tarihi: {new Date(generatedAt).toLocaleString('tr-TR')}
        </p>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Toplam Personel" value={summary.totalStaff.toString()} />
        <SummaryCard label="Uyumlu Personel" value={summary.compliantStaff.toString()} />
        <SummaryCard label="Uyum Oranı" value={`%${summary.complianceRate}`} accentBg={rateC.bg} accentFg={rateC.fg} big />
        <SummaryCard label="Bekleyen Onay" value={summary.pendingApprovals.toString()} />
      </div>

      {/* Unvana göre */}
      <SummaryTable title="Unvana Göre Uyum" rows={summary.byUnvan.map(r => ({ label: r.unvan, total: r.total, compliant: r.compliant, rate: r.rate }))} />

      {/* Departmana göre */}
      <SummaryTable title="Departmana Göre Uyum" rows={summary.byDepartment.map(r => ({ label: r.department, total: r.total, compliant: r.compliant, rate: r.rate }))} />

      {/* Personel detay */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Personel Detayı</h3>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                <th className="w-8"></th>
                {['Ad Soyad', 'Unvan', 'Departman', 'Puan', 'İlerleme', 'Durum'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffDetail.map(s => {
                const sColor = rateColor(s.progress);
                const isOpen = expanded.has(s.userId);
                return (
                  <>
                    <tr key={s.userId} style={{ borderBottom: '1px solid var(--color-border)' }} className="cursor-pointer" onClick={() => toggleRow(s.userId)}>
                      <td className="pl-2">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>{s.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{s.unvan ?? '-'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{s.department ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{s.earnedPoints}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>/ {s.requiredPoints}</span>
                      </td>
                      <td className="px-4 py-3" style={{ minWidth: 120 }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--color-border)' }}>
                            <div className="h-2 rounded-full" style={{ width: `${s.progress}%`, background: sColor.fg }} />
                          </div>
                          <span className="text-xs font-medium w-9 text-right" style={{ color: 'var(--color-text-secondary)' }}>%{s.progress}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: sColor.bg, color: sColor.fg }}>
                          {s.isCompliant ? 'Uyumlu' : s.progress >= 50 ? 'Devam Ediyor' : 'Yetersiz'}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td>
                        <td colSpan={6} className="p-0">
                          <div className="px-4 py-3" style={{ background: 'var(--color-surface-2)' }}>
                            {s.activities.length === 0 ? (
                              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bu personelin onaylı aktivitesi yok.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ color: 'var(--color-text-muted)' }}>
                                    <th className="text-left py-1 font-medium">Aktivite</th>
                                    <th className="text-left py-1 font-medium">Kategori</th>
                                    <th className="text-left py-1 font-medium">Sağlayıcı</th>
                                    <th className="text-left py-1 font-medium">Tarih</th>
                                    <th className="text-right py-1 font-medium">Puan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.activities.map((a, i) => (
                                    <tr key={i}>
                                      <td className="py-1" style={{ color: 'var(--color-text)' }}>{a.title}</td>
                                      <td className="py-1" style={{ color: 'var(--color-text-secondary)' }}>{a.categoryName}</td>
                                      <td className="py-1" style={{ color: 'var(--color-text-secondary)' }}>{a.provider ?? '-'}</td>
                                      <td className="py-1" style={{ color: 'var(--color-text-muted)' }}>{new Date(a.completionDate).toLocaleDateString('tr-TR')}</td>
                                      <td className="py-1 text-right font-semibold" style={{ color: 'var(--color-primary)' }}>{a.smgPoints}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accentBg,
  accentFg,
  big,
}: { label: string; value: string; accentBg?: string; accentFg?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: accentBg ?? 'var(--color-surface)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className={`${big ? 'text-3xl' : 'text-2xl'} font-black mt-1`} style={{ color: accentFg ?? 'var(--color-text)' }}>{value}</p>
    </div>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: Array<{ label: string; total: number; compliant: number; rate: number }> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Kategori</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Toplam</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Uyumlu</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Oran</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const c = rateColor(r.rate);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text)' }}>{r.label}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{r.total}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--color-text-secondary)' }}>{r.compliant}</td>
                  <td className="px-4 py-2" style={{ minWidth: 180 }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--color-border)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${r.rate}%`, background: c.fg }} />
                      </div>
                      <span className="text-xs font-medium w-9 text-right" style={{ color: c.fg }}>%{r.rate}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
