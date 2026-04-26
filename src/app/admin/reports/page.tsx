'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3, Download, FileText, Users, GraduationCap, Building2, AlertTriangle, Clock, Printer,
  TrendingDown, Target, Award, Filter, X, ChevronRight,
} from 'lucide-react';
import { printPage } from '@/lib/export';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KStatCard } from '@/components/admin/k-stat-card';
import { KChartCard } from '@/components/admin/k-chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

type StaffStatus = 'star' | 'normal' | 'risk' | 'new';
type FailureStatus = 'failed' | 'locked';

interface ReportsData {
  overviewStats: { title: string; value: number | string; icon: string; accentColor: string; trend?: { value: number; label: string; isPositive: boolean } }[];
  monthlyData: { month: string; tamamlanan: number; basarisiz: number }[];
  trainingData: { name: string; atanan: number; tamamlayan: number; basarili: number; basarisiz: number; ort: number }[];
  staffPerformance: { name: string; dept: string; completed: number; avgScore: number; status: StaffStatus; color: string }[];
  departmentData: { dept: string; personel: number; tamamlanma: number; ortPuan: number; basarisiz: number; color: string }[];
  failureData: { name: string; dept: string; training: string; attempts: number; maxAttempts: number; lastScore: number; status: FailureStatus; assignmentId: string }[];
  durationData: { training: string; video: number; sinav: number }[];
  scoreComparisonData: { training: string; fullTitle: string; preScore: number; postScore: number; improvement: number; sampleSize: number }[];
  availableDepartments: { id: string; name: string }[];
  truncated: { trainings: { shown: number; total: number } | null; staff: { shown: number; total: number } | null };
}

const iconMap: Record<string, typeof Users> = { GraduationCap, Users, Target, Award };

// Klinova accent color mapping for legacy backend tokens
const accentMap: Record<string, string> = {
  'var(--color-primary)': K.PRIMARY,
  'var(--color-success)': K.SUCCESS,
  'var(--color-warning)': K.WARNING,
  'var(--color-error)': K.ERROR,
  'var(--color-info)': K.INFO,
  'var(--color-accent)': K.WARNING,
};
const mapAccent = (c: string): string => accentMap[c] ?? c;

const tabs = [
  { id: 'overview', label: 'Genel Özet', icon: BarChart3 },
  { id: 'training', label: 'Eğitim Bazlı', icon: GraduationCap },
  { id: 'staff', label: 'Personel', icon: Users },
  { id: 'department', label: 'Departman', icon: Building2 },
  { id: 'failure', label: 'Başarısızlık', icon: AlertTriangle },
  { id: 'score-comparison', label: 'Skor Analizi', icon: TrendingUp },
  { id: 'duration', label: 'Süre Analizi', icon: Clock },
];

const chartTooltipStyle = { background: K.SURFACE, border: '1px solid #c9c4be', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' };

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set('from', new Date(dateFrom).toISOString());
    if (dateTo) p.set('to', new Date(dateTo + 'T23:59:59').toISOString());
    if (departmentId) p.set('departmentId', departmentId);
    return p.toString() ? `?${p.toString()}` : '';
  }, [dateFrom, dateTo, departmentId]);
  const hasFilters = !!(dateFrom || dateTo || departmentId);

  const { data, isLoading, error, refetch } = useFetch<ReportsData>(`/api/admin/reports${filterQuery}`);

  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format);
    try {
      const params = new URLSearchParams({ format, section: activeTab });
      if (dateFrom) params.set('from', new Date(dateFrom).toISOString());
      if (dateTo) params.set('to', new Date(dateTo + 'T23:59:59').toISOString());
      if (departmentId) params.set('departmentId', departmentId);
      const res = await fetch(`/api/admin/reports/export?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? 'Dışa aktarma başarısız');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tabLabel = tabs.find(t => t.id === activeTab)?.label ?? 'Rapor';
      const safeLabel = tabLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      a.download = `rapor-${safeLabel}-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${format.toUpperCase()} raporu indirildi`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Dışa aktarma başarısız', 'error');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="k-card p-8 text-center" style={{ borderColor: K.ERROR }}>
          <p className="text-sm font-semibold" style={{ color: K.ERROR }}>Raporlar yüklenemedi</p>
          <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED }}>{error}</p>
        </div>
      </div>
    );
  }

  const overviewStats = data?.overviewStats ?? [];
  const monthlyData = data?.monthlyData ?? [];
  const trainingData = data?.trainingData ?? [];
  const staffPerformance = data?.staffPerformance ?? [];
  const departmentData = data?.departmentData ?? [];
  const failureData = data?.failureData ?? [];
  const durationData = data?.durationData ?? [];
  const scoreComparisonData = data?.scoreComparisonData ?? [];
  const availableDepartments = data?.availableDepartments ?? [];
  const truncated = data?.truncated ?? { trainings: null, staff: null };
  const hasTruncation = !!(truncated.trainings || truncated.staff);
  const lockedCount = failureData.filter(f => f.status === 'locked').length;

  return (
    <div className="k-page">
      <header className="k-page-header">
        <div>
          <div className="k-breadcrumb">
            <span>Panel</span>
            <ChevronRight size={12} />
            <span data-current="true">Raporlar</span>
          </div>
          <h1 className="k-page-title">Raporlar</h1>
          <p className="k-page-subtitle">Eğitim performansını analiz edin, Excel/PDF olarak dışa aktarın.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('xlsx')} disabled={downloading === 'xlsx'} className="k-btn k-btn-ghost k-btn-sm">
            <Download size={13} /> {downloading === 'xlsx' ? 'İndiriliyor…' : 'Excel'}
          </button>
          <button onClick={() => handleExport('pdf')} disabled={downloading === 'pdf'} className="k-btn k-btn-ghost k-btn-sm">
            <FileText size={13} /> {downloading === 'pdf' ? 'İndiriliyor…' : 'PDF'}
          </button>
          <button onClick={printPage} className="k-btn k-btn-ghost k-btn-sm">
            <Printer size={13} /> Yazdır
          </button>
        </div>
      </header>

      {/* Filtre Paneli */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className="k-btn k-btn-ghost k-btn-sm"
          data-active={hasFilters || undefined}
          style={hasFilters ? { borderColor: K.PRIMARY, color: K.PRIMARY } : undefined}
        >
          <Filter size={13} />
          Filtrele
          {hasFilters && (
            <span className="k-badge k-badge-success" style={{ marginLeft: 4 }}>aktif</span>
          )}
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); setDepartmentId(''); }}
            className="flex items-center gap-1 text-xs"
            style={{ color: K.TEXT_MUTED }}
          >
            <X className="h-3 w-3" /> Filtreleri Temizle
          </button>
        )}
      </div>
      {showFilters && (
        <div className="k-card">
          <div className="k-card-body">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Başlangıç:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="k-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Bitiş:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="k-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              {availableDepartments.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Departman:</label>
                  <select
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                    className="k-input"
                  >
                    <option value="">Tümü</option>
                    {availableDepartments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hasTruncation && (
        <div
          className="k-card"
          style={{ borderColor: K.WARNING, borderLeftWidth: 3, borderLeftColor: K.WARNING }}
        >
          <div className="k-card-body">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: K.WARNING }} />
              <div className="flex-1 text-xs">
                <p className="font-semibold" style={{ color: K.WARNING }}>Veri kırpıldı — filtre uygulayın</p>
                <p className="mt-0.5" style={{ color: K.TEXT_SECONDARY }}>
                  {truncated.trainings && <>{truncated.trainings.total} eğitimden {truncated.trainings.shown} tanesi gösteriliyor. </>}
                  {truncated.staff && <>{truncated.staff.total} personelden {truncated.staff.shown} tanesi gösteriliyor. </>}
                  Daha doğru sonuç için tarih aralığı veya departman filtresi uygulayın.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="k-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="k-tab"
              data-active={isActive}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'failure' && failureData.length > 0 && (
                <span className="k-badge k-badge-error" style={{ marginLeft: 4 }}>{failureData.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewStats.map((s, i) => {
              const Icon = iconMap[s.icon] || Users;
              return (
                <BlurFade key={s.title} delay={i * 0.05}>
                  <KStatCard
                    title={s.title}
                    value={s.value}
                    icon={Icon}
                    accentColor={mapAccent(s.accentColor)}
                    trend={s.trend}
                  />
                </BlurFade>
              );
            })}
          </div>
          {monthlyData.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <BlurFade delay={0.15} className="lg:col-span-2">
                <KChartCard title="Aylık Tamamlanma Trendi" icon={<BarChart3 size={14} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs><linearGradient id="colorTamamlanan" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={K.SUCCESS} stopOpacity={0.2} /><stop offset="95%" stopColor={K.SUCCESS} stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="tamamlanan" name="Tamamlanan" stroke={K.SUCCESS} fill="url(#colorTamamlanan)" strokeWidth={2.5} dot={{ r: 4, fill: K.SUCCESS, strokeWidth: 2, stroke: K.SURFACE }} />
                        <Bar dataKey="basarisiz" name="Başarısız" fill={K.ERROR} radius={[4, 4, 0, 0]} barSize={20} opacity={0.8} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </KChartCard>
              </BlurFade>
              <BlurFade delay={0.2}>
                <div className="k-card h-full">
                  <div className="k-card-body">
                    <h3 className="text-sm font-bold mb-4">En İyi Performans</h3>
                    <div className="space-y-3">
                      {staffPerformance.filter(s => s.status === 'star').sort((a, b) => b.avgScore - a.avgScore).slice(0, 4).map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: i === 0 ? K.WARNING : K.BORDER }}>{i + 1}</span>
                          <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{s.name}</p><p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{s.dept}</p></div>
                          <span className="text-sm font-bold font-mono" style={{ color: K.SUCCESS }}>{s.avgScore}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="my-4 h-px" style={{ background: K.BORDER }} />
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" style={{ color: K.ERROR }} />Risk Altında</h3>
                    <div className="space-y-3">
                      {(() => {
                        const riskList = staffPerformance.filter(s => s.status === 'risk').sort((a, b) => a.avgScore - b.avgScore);
                        if (riskList.length === 0) {
                          return <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Risk altında personel yok</p>;
                        }
                        const visible = riskList.slice(0, 5);
                        const remaining = riskList.length - visible.length;
                        return <>
                          {visible.map((s) => (
                            <div key={s.name} className="flex items-center gap-3">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, #ef4444 12%, transparent)' }}><TrendingDown className="h-3 w-3" style={{ color: K.ERROR }} /></div>
                              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{s.name}</p><p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{s.dept}</p></div>
                              <span className="text-sm font-bold font-mono" style={{ color: K.ERROR }}>{s.avgScore}%</span>
                            </div>
                          ))}
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('staff')}
                              className="w-full rounded-lg px-3 py-2 text-xs font-semibold"
                              style={{ color: K.ERROR, background: 'color-mix(in srgb, #ef4444 10%, transparent)' }}
                            >
                              +{remaining} kişi daha — tümünü gör →
                            </button>
                          )}
                        </>;
                      })()}
                    </div>
                  </div>
                </div>
              </BlurFade>
            </div>
          )}
        </div>
      )}

      {activeTab === 'training' && (
        <BlurFade delay={0.05}>
          <div className="k-card overflow-hidden">
            {trainingData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ background: K.BG }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Eğitim</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Atanan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tamamlayan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Başarılı</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Ort. Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tamamlanma</th></tr></thead>
                  <tbody>
                    {trainingData.map((t, i) => {
                      const rate = t.atanan > 0 ? Math.round((t.tamamlayan / t.atanan) * 100) : 0;
                      const rateColor = rate >= 80 ? K.SUCCESS : rate >= 60 ? K.WARNING : K.ERROR;
                      return (
                        <tr key={`training-${i}`} className="group transition-colors duration-100" style={{ borderBottom: '1px solid #c9c4be' }}>
                          <td className="px-5 py-4"><span className="text-sm font-semibold">{t.name}</span></td>
                          <td className="px-4 py-4 text-sm font-mono">{t.atanan}</td>
                          <td className="px-4 py-4 text-sm font-mono">{t.tamamlayan}</td>
                          <td className="px-4 py-4"><span className="text-sm font-mono font-semibold" style={{ color: K.SUCCESS }}>{t.basarili}</span>{t.basarisiz > 0 && <span className="text-xs ml-1.5" style={{ color: K.ERROR }}>(-{t.basarisiz})</span>}</td>
                          <td className="px-4 py-4 text-sm font-mono font-semibold">{t.ort}%</td>
                          <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2 w-20 rounded-full overflow-hidden" style={{ background: K.BORDER }}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${rate}%`, background: rateColor }} /></div><span className="text-xs font-bold font-mono" style={{ color: rateColor }}>{rate}%</span></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Eğitim ve sınav verileri oluştukça raporlar burada görünecek.</p>}
          </div>
        </BlurFade>
      )}

      {activeTab === 'staff' && (
        <BlurFade delay={0.05}>
          <div className="k-card overflow-hidden">
            {staffPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ background: K.BG }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Personel</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Departman</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tamamlanan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Ort. Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Durum</th></tr></thead>
                  <tbody>
                    {staffPerformance.map((s, i) => (
                      <tr key={`staff-${i}`} className="group transition-colors duration-100" style={{ borderBottom: '1px solid #c9c4be' }}>
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: s.color }}>{s.name.split(' ').map(n => n[0]).join('')}</div><span className="text-sm font-semibold">{s.name}</span></div></td>
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${s.color}15`, color: s.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.dept}</span></td>
                        <td className="px-4 py-4 text-sm font-mono font-semibold">{s.completed}</td>
                        <td className="px-4 py-4"><span className="text-sm font-mono font-bold" style={{ color: s.avgScore >= 70 ? K.SUCCESS : K.ERROR }}>{s.avgScore}%</span></td>
                        <td className="px-4 py-4">
                          {s.status === 'star' && <span className="k-badge k-badge-success"><Award className="h-3 w-3" /> Yıldız</span>}
                          {s.status === 'risk' && <span className="k-badge k-badge-error"><AlertTriangle className="h-3 w-3" /> Risk</span>}
                          {s.status === 'normal' && <span className="k-badge k-badge-muted">Normal</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Eğitim ve sınav verileri oluştukça raporlar burada görünecek.</p>}
          </div>
        </BlurFade>
      )}

      {activeTab === 'department' && (
        <div className="space-y-6">
          {departmentData.length > 0 ? (
            <>
              <BlurFade delay={0.05}>
                <KChartCard title="Departman Karşılaştırması" icon={<Building2 size={14} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} vertical={false} />
                        <XAxis dataKey="dept" tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="tamamlanma" name="Tamamlanma %" fill={K.PRIMARY} radius={[6, 6, 0, 0]} barSize={24} />
                        <Bar dataKey="ortPuan" name="Ort. Puan" fill={K.WARNING} radius={[6, 6, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </KChartCard>
              </BlurFade>
              <BlurFade delay={0.1}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {departmentData.map((d) => {
                    const isGood = d.tamamlanma >= 80;
                    return (
                      <div key={d.dept} className="k-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1">
                        <div className="k-card-body">
                          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ background: d.color }} /><span className="text-sm font-bold">{d.dept}</span></div><span className="text-[11px] font-mono" style={{ color: K.TEXT_MUTED }}>{d.personel} kişi</span></div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between"><span className="text-xs" style={{ color: K.TEXT_MUTED }}>Tamamlanma</span><span className="text-sm font-bold font-mono" style={{ color: isGood ? K.SUCCESS : K.WARNING }}>{d.tamamlanma}%</span></div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: K.BORDER }}><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${d.tamamlanma}%`, background: isGood ? K.SUCCESS : K.WARNING }} /></div>
                            <div className="flex items-center justify-between pt-1"><span className="text-xs" style={{ color: K.TEXT_MUTED }}>Ort. Puan</span><span className="text-xs font-semibold font-mono">{d.ortPuan}%</span></div>
                          </div>
                          {d.basarisiz > 0 && <div className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'color-mix(in srgb, #ef4444 10%, transparent)' }}><AlertTriangle className="h-3 w-3" style={{ color: K.ERROR }} /><span className="text-[11px] font-semibold" style={{ color: K.ERROR }}>{d.basarisiz} başarısız</span></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </BlurFade>
            </>
          ) : <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Eğitim ve sınav verileri oluştukça raporlar burada görünecek.</p>}
        </div>
      )}

      {activeTab === 'failure' && (
        <div className="space-y-6">
          {lockedCount > 0 && (
            <BlurFade delay={0.05}>
              <div className="flex items-center gap-4 rounded-2xl p-5" style={{ background: K.ERROR, boxShadow: '0 4px 20px rgba(220, 38, 38, 0.2)' }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}><AlertTriangle className="h-6 w-6 text-white" /></div>
                <div><p className="text-lg font-bold text-white">{lockedCount} personel kilitlendi</p><p className="text-sm text-white/70">Tüm deneme haklarını tüketen personeller yeni hak bekliyor</p></div>
              </div>
            </BlurFade>
          )}
          <BlurFade delay={0.1}>
            <div className="k-card overflow-hidden">
              {failureData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: K.BG }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Personel</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Departman</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Eğitim</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Deneme</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Son Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>İşlem</th></tr></thead>
                    <tbody>
                      {failureData.map((f, i) => (
                        <tr key={i} className="transition-colors duration-100" style={{ borderBottom: '1px solid #c9c4be' }}>
                          <td className="px-5 py-4 text-sm font-semibold">
                            <div className="flex items-center gap-2">
                              {f.name}
                              {f.status === 'locked' && (
                                <span className="k-badge k-badge-error">
                                  <AlertTriangle className="h-2.5 w-2.5" /> KİLİTLİ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm" style={{ color: K.TEXT_SECONDARY }}>{f.dept}</td>
                          <td className="px-4 py-4 text-sm">{f.training}</td>
                          <td className="px-4 py-4 text-sm font-mono font-semibold" style={{ color: K.ERROR }}>{f.attempts}/{f.maxAttempts}</td>
                          <td className="px-4 py-4 text-sm font-mono font-bold" style={{ color: K.ERROR }}>{f.lastScore}%</td>
                          <td className="px-4 py-4">
                            <Button size="sm" className="gap-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: K.PRIMARY }} onClick={async () => {
                              if (window.confirm(`${f.name} için "${f.training}" eğitiminde yeni deneme hakkı verilsin mi?`)) {
                                try { const res = await fetch('/api/admin/trainings/reset-attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId: f.assignmentId }) }); if (!res.ok) { const d = await res.json(); throw new Error(d.error); } toast(`${f.name} için yeni deneme hakkı verildi.`, 'success'); refetch(); } catch (err) { toast(err instanceof Error ? err.message : 'İşlem başarısız', 'error'); }
                              }
                            }}>Yeni Hak Ver</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Başarısız personel yok</p>}
            </div>
          </BlurFade>
        </div>
      )}

      {activeTab === 'score-comparison' && (
        <div className="space-y-6">
          {scoreComparisonData.length > 0 ? (
            <>
              <BlurFade delay={0.05}>
                <KChartCard title="Ön Sınav → Son Sınav Skor Karşılaştırması" icon={<TrendingUp size={14} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={scoreComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} vertical={false} />
                        <XAxis dataKey="training" tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v}%`]} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="preScore" name="Ön Sınav Ort." fill={K.INFO} radius={[6, 6, 0, 0]} barSize={22} />
                        <Bar dataKey="postScore" name="Son Sınav Ort." fill={K.PRIMARY} radius={[6, 6, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </KChartCard>
              </BlurFade>

              {/* Improvement table */}
              <BlurFade delay={0.1}>
                <div className="k-card overflow-hidden">
                  <div className="k-card-head">
                    <div>
                      <h3 className="text-sm font-bold">Eğitim Başına Gelişim</h3>
                      <p className="text-[12px] mt-0.5" style={{ color: K.TEXT_MUTED }}>Son sınav − Ön sınav farkı</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: K.BG }}>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Eğitim</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Ön Sınav</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Son Sınav</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Gelişim</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Örneklem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreComparisonData.map((d) => {
                          const isPositive = d.improvement >= 0;
                          return (
                            <tr key={d.fullTitle} className="transition-colors duration-100" style={{ borderBottom: '1px solid #c9c4be' }}>
                              <td className="px-5 py-3.5 text-sm font-semibold max-w-[220px] truncate" title={d.fullTitle}>{d.fullTitle}</td>
                              <td className="px-4 py-3.5 text-center font-mono text-sm" style={{ color: K.INFO }}>{d.preScore}%</td>
                              <td className="px-4 py-3.5 text-center font-mono text-sm font-semibold" style={{ color: K.PRIMARY }}>{d.postScore}%</td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`k-badge ${isPositive ? 'k-badge-success' : 'k-badge-error'}`}>
                                  {isPositive ? '+' : ''}{d.improvement}%
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center text-sm font-mono" style={{ color: K.TEXT_MUTED }}>{d.sampleSize}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </BlurFade>
            </>
          ) : (
            <div className="k-card flex flex-col items-center justify-center py-16">
              <TrendingUp className="h-8 w-8 mb-3" style={{ color: K.TEXT_MUTED }} />
              <p className="text-sm font-semibold mb-1">Sınavlar tamamlandıkça skor verileri burada görünecek.</p>
              <p className="text-[12px]" style={{ color: K.TEXT_MUTED }}>En az bir sınav tamamlandığında karşılaştırma grafiği burada görünecek</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'duration' && (
        <div className="space-y-6">
          {durationData.length > 0 ? (
            <BlurFade delay={0.05}>
              <KChartCard title="Ortalama Süre Karşılaştırması (dakika)" icon={<Clock size={14} />}>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={durationData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} unit=" dk" />
                      <YAxis dataKey="training" type="category" tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="video" name="Video Süresi" fill={K.PRIMARY} radius={[0, 6, 6, 0]} barSize={18} />
                      <Bar dataKey="sinav" name="Sınav Süresi" fill={K.WARNING} radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </KChartCard>
            </BlurFade>
          ) : <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Eğitim süre verileri sınavlar tamamlandıkça burada görünecek.</p>}
        </div>
      )}
    </div>
  );
}
