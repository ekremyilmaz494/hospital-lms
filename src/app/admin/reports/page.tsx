'use client';

import { useState } from 'react';
import {
  BarChart3, Download, FileText, Users, GraduationCap, Building2, AlertTriangle, Clock, Printer,
  TrendingDown, Target, Award, Filter, X,
} from 'lucide-react';
import { exportExcel, printPage } from '@/lib/export';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from '@/components/shared/recharts';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface ReportsData {
  overviewStats: { title: string; value: number | string; icon: string; accentColor: string; trend?: { value: number; label: string; isPositive: boolean } }[];
  monthlyData: { month: string; tamamlanan: number; basarisiz: number }[];
  trainingData: { name: string; atanan: number; tamamlayan: number; basarili: number; basarisiz: number; ort: number }[];
  staffPerformance: { name: string; dept: string; completed: number; avgScore: number; status: string; color: string }[];
  departmentData: { dept: string; personel: number; tamamlanma: number; ortPuan: number; basarisiz: number; color: string }[];
  failureData: { name: string; dept: string; training: string; attempts: number; lastScore: number; status: string; assignmentId: string }[];
  durationData: { training: string; video: number; sinav: number }[];
  scoreComparisonData: { training: string; fullTitle: string; preScore: number; postScore: number; improvement: number; sampleSize: number }[];
}

const iconMap: Record<string, typeof Users> = { GraduationCap, Users, Target, Award };

const tabs = [
  { id: 'overview', label: 'Genel Özet', icon: BarChart3 },
  { id: 'training', label: 'Eğitim Bazlı', icon: GraduationCap },
  { id: 'staff', label: 'Personel', icon: Users },
  { id: 'department', label: 'Departman', icon: Building2 },
  { id: 'failure', label: 'Başarısızlık', icon: AlertTriangle },
  { id: 'score-comparison', label: 'Skor Analizi', icon: TrendingUp },
  { id: 'duration', label: 'Süre Analizi', icon: Clock },
];

const chartTooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px', boxShadow: 'var(--shadow-md)' };

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filterParams = new URLSearchParams();
  if (dateFrom) filterParams.set('from', new Date(dateFrom).toISOString());
  if (dateTo) filterParams.set('to', new Date(dateTo + 'T23:59:59').toISOString());
  const filterQuery = filterParams.toString() ? `?${filterParams.toString()}` : '';
  const hasFilters = !!(dateFrom || dateTo);

  const { data, isLoading, error } = useFetch<ReportsData>(`/api/admin/reports${filterQuery}`);

  const handlePDFExport = async () => {
    const res = await fetch('/api/admin/export/pdf?type=training-report');
    if (!res.ok) { toast('PDF oluşturulamadı', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapor.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <PageLoading />;
  }
  if (error) {
    return <div className="flex items-center justify-center py-20"><div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}><p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>Raporlar yüklenemedi</p><p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{error}</p></div></div>;
  }

  const overviewStats = data?.overviewStats ?? [];
  const monthlyData = data?.monthlyData ?? [];
  const trainingData = data?.trainingData ?? [];
  const staffPerformance = data?.staffPerformance ?? [];
  const departmentData = data?.departmentData ?? [];
  const failureData = data?.failureData ?? [];
  const durationData = data?.durationData ?? [];
  const scoreComparisonData = data?.scoreComparisonData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Raporlar" subtitle="Eğitim performansını analiz edin" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={() => exportExcel(data ? { headers: ['Eğitim', 'Atanan', 'Tamamlayan', 'Başarılı', 'Başarısız', 'Ort. Puan'], rows: data.trainingData.map(t => [t.name, t.atanan, t.tamamlayan, t.basarili, t.basarisiz, t.ort]) } : undefined)}><Download className="h-3.5 w-3.5" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={handlePDFExport}><FileText className="h-3.5 w-3.5" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={printPage}><Printer className="h-3.5 w-3.5" /> Yazdır</Button>
        </div>
      </div>

      {/* Filtre Paneli */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
          style={{ background: hasFilters ? 'var(--color-primary-light)' : 'var(--color-surface)', border: `1px solid ${hasFilters ? 'var(--color-primary)' : 'var(--color-border)'}`, color: hasFilters ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
        >
          <Filter className="h-4 w-4" />
          Filtrele
          {hasFilters && <span className="rounded-full bg-current/20 px-1.5 py-0.5 text-xs">aktif</span>}
        </button>
        {hasFilters && (
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <X className="h-3 w-3" /> Filtreleri Temizle
          </button>
        )}
      </div>
      {showFilters && (
        <div className="flex items-center gap-4 rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Başlangıç:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Bitiş:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl p-1.5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200" style={{ background: isActive ? 'var(--color-primary)' : 'transparent', color: isActive ? 'white' : 'var(--color-text-muted)', boxShadow: isActive ? '0 2px 8px rgba(var(--color-primary-rgb), 0.3)' : 'none' }}>
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'failure' && failureData.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-error-bg)', color: isActive ? 'white' : 'var(--color-error)' }}>{failureData.length}</span>
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
              return <BlurFade key={s.title} delay={i * 0.05}><StatCard title={s.title} value={s.value} icon={Icon} accentColor={s.accentColor} trend={s.trend} /></BlurFade>;
            })}
          </div>
          {monthlyData.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <BlurFade delay={0.15} className="lg:col-span-2">
                <ChartCard title="Aylık Tamamlanma Trendi" icon={<BarChart3 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs><linearGradient id="colorTamamlanan" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="tamamlanan" name="Tamamlanan" stroke="var(--color-success)" fill="url(#colorTamamlanan)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-success)', strokeWidth: 2, stroke: 'var(--color-surface)' }} />
                        <Bar dataKey="basarisiz" name="Başarısız" fill="var(--color-error)" radius={[4, 4, 0, 0]} barSize={20} opacity={0.8} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </BlurFade>
              <BlurFade delay={0.2}>
                <div className="rounded-2xl border p-6 h-full" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 className="text-sm font-bold mb-4">En İyi Performans</h3>
                  <div className="space-y-3">
                    {staffPerformance.filter(s => s.status === 'star').slice(0, 4).map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: i === 0 ? 'var(--color-accent)' : 'var(--color-border)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{s.name}</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{s.dept}</p></div>
                        <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-success)' }}>{s.avgScore}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="my-4 h-px" style={{ background: 'var(--color-border)' }} />
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />Risk Altında</h3>
                  <div className="space-y-3">
                    {staffPerformance.filter(s => s.status === 'risk').length > 0 ? staffPerformance.filter(s => s.status === 'risk').map((s) => (
                      <div key={s.name} className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: 'var(--color-error-bg)' }}><TrendingDown className="h-3 w-3" style={{ color: 'var(--color-error)' }} /></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{s.name}</p><p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{s.dept}</p></div>
                        <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-error)' }}>{s.avgScore}%</span>
                      </div>
                    )) : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Risk altında personel yok</p>}
                  </div>
                </div>
              </BlurFade>
            </div>
          )}
        </div>
      )}

      {activeTab === 'training' && (
        <BlurFade delay={0.05}>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            {trainingData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ background: 'var(--color-bg)' }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Atanan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tamamlayan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Başarılı</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ort. Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tamamlanma</th></tr></thead>
                  <tbody>
                    {trainingData.map((t) => {
                      const rate = t.atanan > 0 ? Math.round((t.tamamlayan / t.atanan) * 100) : 0;
                      const rateColor = rate >= 80 ? 'var(--color-success)' : rate >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
                      return (
                        <tr key={t.name} className="group transition-colors duration-100 hover:bg-(--color-surface-hover)" style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-5 py-4"><span className="text-sm font-semibold">{t.name}</span></td>
                          <td className="px-4 py-4 text-sm font-mono">{t.atanan}</td>
                          <td className="px-4 py-4 text-sm font-mono">{t.tamamlayan}</td>
                          <td className="px-4 py-4"><span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-success)' }}>{t.basarili}</span>{t.basarisiz > 0 && <span className="text-xs ml-1.5" style={{ color: 'var(--color-error)' }}>(-{t.basarisiz})</span>}</td>
                          <td className="px-4 py-4 text-sm font-mono font-semibold">{t.ort}%</td>
                          <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="h-2 w-20 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${rate}%`, background: rateColor }} /></div><span className="text-xs font-bold font-mono" style={{ color: rateColor }}>{rate}%</span></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>}
          </div>
        </BlurFade>
      )}

      {activeTab === 'staff' && (
        <BlurFade delay={0.05}>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            {staffPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ background: 'var(--color-bg)' }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Departman</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tamamlanan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ort. Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th></tr></thead>
                  <tbody>
                    {staffPerformance.map((s) => (
                      <tr key={s.name} className="group transition-colors duration-100 hover:bg-(--color-surface-hover)" style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: s.color }}>{s.name.split(' ').map(n => n[0]).join('')}</div><span className="text-sm font-semibold">{s.name}</span></div></td>
                        <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${s.color}15`, color: s.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.dept}</span></td>
                        <td className="px-4 py-4 text-sm font-mono font-semibold">{s.completed}</td>
                        <td className="px-4 py-4"><span className="text-sm font-mono font-bold" style={{ color: s.avgScore >= 70 ? 'var(--color-success)' : 'var(--color-error)' }}>{s.avgScore}%</span></td>
                        <td className="px-4 py-4">
                          {s.status === 'star' && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}><Award className="h-3 w-3" /> Yıldız</span>}
                          {s.status === 'risk' && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}><AlertTriangle className="h-3 w-3" /> Risk</span>}
                          {s.status === 'normal' && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>Normal</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>}
          </div>
        </BlurFade>
      )}

      {activeTab === 'department' && (
        <div className="space-y-6">
          {departmentData.length > 0 ? (
            <>
              <BlurFade delay={0.05}>
                <ChartCard title="Departman Karşılaştırması" icon={<Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="dept" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="tamamlanma" name="Tamamlanma %" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={24} />
                        <Bar dataKey="ortPuan" name="Ort. Puan" fill="var(--color-accent)" radius={[6, 6, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </BlurFade>
              <BlurFade delay={0.1}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {departmentData.map((d) => {
                    const isGood = d.tamamlanma >= 80;
                    return (
                      <div key={d.dept} className="rounded-2xl border p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                        <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ background: d.color }} /><span className="text-sm font-bold">{d.dept}</span></div><span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{d.personel} kişi</span></div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between"><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Tamamlanma</span><span className="text-sm font-bold font-mono" style={{ color: isGood ? 'var(--color-success)' : 'var(--color-warning)' }}>{d.tamamlanma}%</span></div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${d.tamamlanma}%`, background: isGood ? 'var(--color-success)' : 'var(--color-warning)' }} /></div>
                          <div className="flex items-center justify-between pt-1"><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ort. Puan</span><span className="text-xs font-semibold font-mono">{d.ortPuan}%</span></div>
                        </div>
                        {d.basarisiz > 0 && <div className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--color-error-bg)' }}><AlertTriangle className="h-3 w-3" style={{ color: 'var(--color-error)' }} /><span className="text-[11px] font-semibold" style={{ color: 'var(--color-error)' }}>{d.basarisiz} başarısız</span></div>}
                      </div>
                    );
                  })}
                </div>
              </BlurFade>
            </>
          ) : <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>}
        </div>
      )}

      {activeTab === 'failure' && (
        <div className="space-y-6">
          {failureData.filter(f => f.status === 'locked').length > 0 && (
            <BlurFade delay={0.05}>
              <div className="flex items-center gap-4 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, var(--color-error), #991b1b)', boxShadow: '0 4px 20px rgba(220, 38, 38, 0.2)' }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}><AlertTriangle className="h-6 w-6 text-white" /></div>
                <div><p className="text-lg font-bold text-white">{failureData.filter(f => f.status === 'locked').length} personel kilitlendi</p><p className="text-sm text-white/70">3 deneme hakkını tüketen personeller yeni hak bekliyor</p></div>
              </div>
            </BlurFade>
          )}
          <BlurFade delay={0.1}>
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              {failureData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: 'var(--color-bg)' }}><th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Departman</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Deneme</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Puan</th><th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th></tr></thead>
                    <tbody>
                      {failureData.map((f, i) => (
                        <tr key={i} className="transition-colors duration-100 hover:bg-(--color-surface-hover)" style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td className="px-5 py-4 text-sm font-semibold">{f.name}</td>
                          <td className="px-4 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{f.dept}</td>
                          <td className="px-4 py-4 text-sm">{f.training}</td>
                          <td className="px-4 py-4 text-sm font-mono font-semibold" style={{ color: 'var(--color-error)' }}>{f.attempts}/3</td>
                          <td className="px-4 py-4 text-sm font-mono font-bold" style={{ color: 'var(--color-error)' }}>{f.lastScore}%</td>
                          <td className="px-4 py-4">
                            <Button size="sm" className="gap-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--color-primary)' }} onClick={async () => {
                              if (window.confirm(`${f.name} için "${f.training}" eğitiminde yeni deneme hakkı verilsin mi?`)) {
                                try { const res = await fetch('/api/admin/trainings/reset-attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignmentId: f.assignmentId }) }); if (!res.ok) { const d = await res.json(); throw new Error(d.error); } toast(`${f.name} için yeni deneme hakkı verildi.`, 'success'); } catch (err) { toast(err instanceof Error ? err.message : 'İşlem başarısız', 'error'); }
                              }
                            }}>Yeni Hak Ver</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Başarısız personel yok</p>}
            </div>
          </BlurFade>
        </div>
      )}

      {activeTab === 'score-comparison' && (
        <div className="space-y-6">
          {scoreComparisonData.length > 0 ? (
            <>
              <BlurFade delay={0.05}>
                <ChartCard title="Ön Sınav → Son Sınav Skor Karşılaştırması" icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={scoreComparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="training" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v}%`]} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="preScore" name="Ön Sınav Ort." fill="var(--color-info)" radius={[6, 6, 0, 0]} barSize={22} />
                        <Bar dataKey="postScore" name="Son Sınav Ort." fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </BlurFade>

              {/* Improvement table */}
              <BlurFade delay={0.1}>
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="text-sm font-bold">Eğitim Başına Gelişim</h3>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Son sınav − Ön sınav farkı</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--color-bg)' }}>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ön Sınav</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Sınav</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Gelişim</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Örneklem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreComparisonData.map((d) => {
                          const isPositive = d.improvement >= 0;
                          return (
                            <tr key={d.fullTitle} className="transition-colors duration-100 hover:bg-(--color-surface-hover)" style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td className="px-5 py-3.5 text-sm font-semibold max-w-[220px] truncate" title={d.fullTitle}>{d.fullTitle}</td>
                              <td className="px-4 py-3.5 text-center font-mono text-sm" style={{ color: 'var(--color-info)' }}>{d.preScore}%</td>
                              <td className="px-4 py-3.5 text-center font-mono text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{d.postScore}%</td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold font-mono"
                                  style={{
                                    background: isPositive ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                                    color: isPositive ? 'var(--color-success)' : 'var(--color-error)',
                                  }}
                                >
                                  {isPositive ? '+' : ''}{d.improvement}%
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center text-sm font-mono" style={{ color: 'var(--color-text-muted)' }}>{d.sampleSize}</td>
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
            <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <TrendingUp className="h-8 w-8 mb-3" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm font-semibold mb-1">Henüz skor verisi yok</p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>En az bir sınav tamamlandığında karşılaştırma grafiği burada görünecek</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'duration' && (
        <div className="space-y-6">
          {durationData.length > 0 ? (
            <BlurFade delay={0.05}>
              <ChartCard title="Ortalama Süre Karşılaştırması (dakika)" icon={<Clock className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />}>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={durationData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} unit=" dk" />
                      <YAxis dataKey="training" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="video" name="Video Süresi" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={18} />
                      <Bar dataKey="sinav" name="Sınav Süresi" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </BlurFade>
          ) : <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz süre verisi yok</p>}
        </div>
      )}
    </div>
  );
}
