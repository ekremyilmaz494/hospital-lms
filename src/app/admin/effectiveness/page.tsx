'use client';

import { useState } from 'react';
import { TrendingUp, BarChart3, Award, Target, ArrowUpRight, ArrowDownRight, Calendar, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { KChartCard } from '@/components/admin/k-chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { KStatCard } from '@/components/admin/k-stat-card';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

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

interface TrainingEff { id: string; title: string; category: string | null; isCompulsory: boolean; avgPreScore: number | null; avgPostScore: number | null; avgLearningGain: number | null; passRate: number; totalAttempts: number }
interface EffData {
  summary: { totalTrainingsAnalyzed: number; totalAttempts: number; overallPassRate: number; avgLearningGain: number | null };
  globalTrend: { month: string; passRate: number; avgPostScore: number }[];
  categoryBreakdown: { category: string; trainingCount: number; totalAttempts: number; passRate: number; avgGain: number | null }[];
  trainingEffectiveness: TrainingEff[];
}

const tooltipStyle = { background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: '12px', fontSize: '12px' };

export default function EffectivenessPage() {
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const { data, isLoading } = useFetch<EffData>(`/api/admin/effectiveness?period=${period}`);
  if (isLoading) return <PageLoading />;

  const summary = data?.summary;
  const trainings = data?.trainingEffectiveness ?? [];
  const globalTrend = data?.globalTrend ?? [];
  const categories = data?.categoryBreakdown ?? [];

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">Etkinlik Analizi</span>
            </div>
            <h1 className="k-page-title">Etkinlik Analizi</h1>
            <p className="k-page-subtitle">Eğitimlerin öğrenme kazanımı ve başarı performansı.</p>
          </div>
        </header>
      </BlurFade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Analiz Edilen', value: summary?.totalTrainingsAnalyzed ?? 0, icon: BarChart3, accentColor: K.PRIMARY },
          { title: 'Toplam Deneme', value: summary?.totalAttempts ?? 0, icon: Target, accentColor: K.INFO },
          { title: 'Başarı Oranı', value: `%${summary?.overallPassRate ?? 0}`, icon: Award, accentColor: K.SUCCESS },
          { title: 'Ort. Kazanım', value: summary?.avgLearningGain != null ? `+${summary.avgLearningGain}` : '—', icon: TrendingUp, accentColor: K.ACCENT },
        ].map((s, i) => (
          <BlurFade key={s.title} delay={0.05 + i * 0.03}><KStatCard {...s} /></BlurFade>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0.2} className="lg:col-span-2">
          <KChartCard
            title={period === 'monthly' ? 'Aylık Başarı Trendi' : 'Haftalık Başarı Trendi'}
            icon={<TrendingUp size={15} />}
            action={
              <div className="k-tabs">
                {([['monthly', 'Aylık'], ['weekly', 'Haftalık']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    className="k-tab"
                    data-active={period === key}
                  >
                    <Calendar size={12} />
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-64">
              {globalTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={globalTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={K.BORDER_LIGHT} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: K.TEXT_MUTED }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="passRate" name="Başarı %" fill={K.SUCCESS} radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="avgPostScore" name="Ort. Puan" fill={K.INFO} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-sm" style={{ color: K.TEXT_MUTED }}>Sınavlar tamamlandıkça başarı trendi burada görünecek.</div>}
            </div>
          </KChartCard>
        </BlurFade>

        <BlurFade delay={0.25}>
          <div className="k-card p-6 h-full">
            <h3 className="text-sm font-bold mb-4" style={{ color: K.TEXT_PRIMARY }}>Kategori Bazlı</h3>
            {categories.length > 0 ? (
              <div className="space-y-3">
                {categories.map(c => (
                  <div key={c.category} className="flex items-center justify-between rounded-xl p-3" style={{ border: `1px solid ${K.BORDER}` }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>{c.category}</p>
                      <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{c.trainingCount} eğitim</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: c.passRate >= 70 ? K.SUCCESS : K.ERROR }}>%{c.passRate}</p>
                      {c.avgGain != null && <p className="text-[11px] font-mono" style={{ color: c.avgGain >= 0 ? K.SUCCESS : K.ERROR }}>{c.avgGain >= 0 ? '+' : ''}{c.avgGain}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm" style={{ color: K.TEXT_MUTED }}>Kategori bazlı veriler eğitimler oluşturuldukça görünecek.</div>}
          </div>
        </BlurFade>
      </div>

      <BlurFade delay={0.3}>
        <div className="k-card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: K.BORDER }}>
            <h3 className="text-sm font-bold" style={{ color: K.TEXT_PRIMARY }}>Eğitim Bazlı Etkinlik</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: K.BG }}>
                {['Eğitim', 'Deneme', 'Ön Sınav', 'Son Sınav', 'Kazanım', 'Başarı'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase" style={{ color: K.TEXT_MUTED }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainings.map(t => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{t.category ?? '—'}{t.isCompulsory ? ' · Zorunlu' : ''}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono">{t.totalAttempts}</td>
                  <td className="px-5 py-3.5 font-mono">{t.avgPreScore ?? '—'}</td>
                  <td className="px-5 py-3.5 font-mono font-bold">{t.avgPostScore ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    {t.avgLearningGain != null ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold" style={{ color: t.avgLearningGain >= 0 ? K.SUCCESS : K.ERROR }}>
                        {t.avgLearningGain >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {t.avgLearningGain >= 0 ? '+' : ''}{t.avgLearningGain}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: t.passRate >= 70 ? K.SUCCESS_BG : K.ERROR_BG, color: t.passRate >= 70 ? K.SUCCESS : K.ERROR }}>%{t.passRate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trainings.length === 0 && <div className="text-center py-12 text-sm" style={{ color: K.TEXT_MUTED }}>Eğitimlere sınav ekleyip personel atadıkça etkinlik analizi burada görünecek.</div>}
        </div>
      </BlurFade>
    </div>
  );
}
