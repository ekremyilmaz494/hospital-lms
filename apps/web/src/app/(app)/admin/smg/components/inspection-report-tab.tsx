'use client';

import { Fragment, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Printer, ChevronDown, ChevronRight, FileCheck2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Button } from '@/components/ui/button';
import { exportExcel } from '@/lib/export';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

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
  /** URL query string ile period persistansı. Varsayılan false — ana sayfa sekmesinde tema temiz kalsın diye. */
  syncWithUrl?: boolean;
}

function rateColor(rate: number) {
  if (rate >= 100) return { bg: K.SUCCESS_BG, fg: K.SUCCESS };
  if (rate >= 50) return { bg: K.WARNING_BG, fg: K.WARNING };
  return { bg: K.ERROR_BG, fg: K.ERROR };
}

export function InspectionReportTab({ periods, syncWithUrl = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlPeriodId = syncWithUrl ? (searchParams?.get('periodId') ?? '') : '';

  const [periodId, setPeriodId] = useState(urlPeriodId || periods[0]?.id || '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!syncWithUrl) return;
    if (urlPeriodId !== periodId) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (periodId) params.set('periodId', periodId);
      else params.delete('periodId');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, syncWithUrl]);

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
    return <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Rapor hazırlanıyor...</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Rapor verisi alınamadı.</div>;
  }

  const { summary, staffDetail, period, organizationName, generatedAt } = data;
  const rateC = rateColor(summary.complianceRate);

  return (
    <div className="p-4 space-y-6 print:p-0">
      {/* Filtre & export */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-xs font-semibold" style={{ color: K.TEXT_SECONDARY }}>Dönem:</label>
        <select
          value={periodId}
          onChange={e => setPeriodId(e.target.value)}
          className="text-sm rounded-xl px-3 py-1.5 outline-none"
          style={{ border: `1.5px solid ${K.BORDER}`, background: K.SURFACE, color: K.TEXT_PRIMARY }}
        >
          <option value="">Aktif Dönem</option>
          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="gap-1.5 rounded-xl"
            style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
          >
            <Download className="h-4 w-4" /> Excel İndir
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-1.5 rounded-xl"
            style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
          >
            <Printer className="h-4 w-4" /> Yazdır
          </Button>
        </div>
      </div>

      {/* Rapor Başlığı (print için) */}
      <div className="text-center pb-4" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
        <FileCheck2 className="h-10 w-10 mx-auto mb-2" style={{ color: K.PRIMARY }} />
        <h2 className="text-xl font-bold" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>SKS Denetim Raporu</h2>
        <p className="text-sm mt-1" style={{ color: K.TEXT_SECONDARY }}>{organizationName}</p>
        {period && (
          <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED }}>
            {period.name} · {new Date(period.startDate).toLocaleDateString('tr-TR')} — {new Date(period.endDate).toLocaleDateString('tr-TR')}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED }}>
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

      <SummaryTable title="Unvana Göre Uyum" rows={summary.byUnvan.map(r => ({ label: r.unvan, total: r.total, compliant: r.compliant, rate: r.rate }))} />

      <SummaryTable title="Departmana Göre Uyum" rows={summary.byDepartment.map(r => ({ label: r.department, total: r.total, compliant: r.compliant, rate: r.rate }))} />

      {/* Personel detay */}
      <div>
        <h3 className="font-bold mb-3" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>
          Personel Detayı
        </h3>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1.5px solid ${K.BORDER}`, background: K.SURFACE, boxShadow: K.SHADOW_CARD }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
                <th className="w-8"></th>
                {['Ad Soyad', 'Unvan', 'Departman', 'Puan', 'İlerleme', 'Durum'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-semibold uppercase tracking-wide"
                    style={{ color: K.TEXT_MUTED, fontSize: 11 }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffDetail.map((s, idx) => {
                const sColor = rateColor(s.progress);
                const isOpen = expanded.has(s.userId);
                return (
                  <Fragment key={`${s.userId}-${idx}`}>
                    <tr
                      style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
                      className="cursor-pointer"
                      onClick={() => toggleRow(s.userId)}
                    >
                      <td className="pl-2" style={{ color: K.TEXT_MUTED }}>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: K.TEXT_PRIMARY }}>{s.name}</td>
                      <td className="px-4 py-3" style={{ color: K.TEXT_SECONDARY }}>{s.unvan ?? '-'}</td>
                      <td className="px-4 py-3" style={{ color: K.TEXT_SECONDARY }}>{s.department ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold" style={{ color: K.PRIMARY }}>{s.earnedPoints}</span>
                        <span className="text-xs ml-1" style={{ color: K.TEXT_MUTED }}>/ {s.requiredPoints}</span>
                      </td>
                      <td className="px-4 py-3" style={{ minWidth: 120 }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
                            <div className="h-2 rounded-full" style={{ width: `${s.progress}%`, background: sColor.fg }} />
                          </div>
                          <span className="text-xs font-medium w-9 text-right" style={{ color: K.TEXT_SECONDARY }}>%{s.progress}</span>
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
                          <div className="px-4 py-3" style={{ background: K.BG }}>
                            {s.activities.length === 0 ? (
                              <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Bu personelin onaylı aktivitesi yok.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ color: K.TEXT_MUTED }}>
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
                                      <td className="py-1" style={{ color: K.TEXT_PRIMARY }}>{a.title}</td>
                                      <td className="py-1" style={{ color: K.TEXT_SECONDARY }}>{a.categoryName}</td>
                                      <td className="py-1" style={{ color: K.TEXT_SECONDARY }}>{a.provider ?? '-'}</td>
                                      <td className="py-1" style={{ color: K.TEXT_MUTED }}>{new Date(a.completionDate).toLocaleDateString('tr-TR')}</td>
                                      <td className="py-1 text-right font-semibold" style={{ color: K.PRIMARY }}>{a.smgPoints}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
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
    <div
      className="rounded-2xl p-4"
      style={{
        border: `1.5px solid ${K.BORDER}`,
        background: accentBg ?? K.SURFACE,
        boxShadow: K.SHADOW_CARD,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED, fontSize: 11 }}>{label}</p>
      <p
        className={`${big ? 'text-3xl' : 'text-2xl'} font-black mt-1`}
        style={{ color: accentFg ?? K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: Array<{ label: string; total: number; compliant: number; rate: number }> }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="font-bold mb-3" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>{title}</h3>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1.5px solid ${K.BORDER}`, background: K.SURFACE, boxShadow: K.SHADOW_CARD }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED, fontSize: 11 }}>Kategori</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED, fontSize: 11 }}>Toplam</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED, fontSize: 11 }}>Uyumlu</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED, fontSize: 11 }}>Oran</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const c = rateColor(r.rate);
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                  <td className="px-4 py-2 font-medium" style={{ color: K.TEXT_PRIMARY }}>{r.label}</td>
                  <td className="px-4 py-2" style={{ color: K.TEXT_SECONDARY }}>{r.total}</td>
                  <td className="px-4 py-2" style={{ color: K.TEXT_SECONDARY }}>{r.compliant}</td>
                  <td className="px-4 py-2" style={{ minWidth: 180 }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
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
