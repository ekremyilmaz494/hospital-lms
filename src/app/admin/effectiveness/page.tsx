'use client';

import { useState } from 'react';
import { TrendingUp, BarChart3, Award, Target, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PageHeader } from '@/components/shared/page-header';
import { ChartCard } from '@/components/shared/chart-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { StatCard } from '@/components/shared/stat-card';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface TrainingEff { id: string; title: string; category: string | null; isCompulsory: boolean; avgPreScore: number | null; avgPostScore: number | null; avgLearningGain: number | null; passRate: number; totalAttempts: number }
interface EffData {
  summary: { totalTrainingsAnalyzed: number; totalAttempts: number; overallPassRate: number; avgLearningGain: number | null };
  globalTrend: { month: string; passRate: number; avgPostScore: number }[];
  categoryBreakdown: { category: string; trainingCount: number; totalAttempts: number; passRate: number; avgGain: number | null }[];
  trainingEffectiveness: TrainingEff[];
}

const tooltipStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' };

export default function EffectivenessPage() {
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const { data, isLoading } = useFetch<EffData>(`/api/admin/effectiveness?period=${period}`);
  if (isLoading) return <PageLoading />;

  const summary = data?.summary;
  const trainings = data?.trainingEffectiveness ?? [];
  const globalTrend = data?.globalTrend ?? [];
  const categories = data?.categoryBreakdown ?? [];

  return (
    <div className="space-y-6">
      <BlurFade delay={0}><PageHeader title="Etkinlik Analizi" subtitle="Eğitimlerin öğrenme kazanımı ve başarı performansı" /></BlurFade>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Analiz Edilen', value: summary?.totalTrainingsAnalyzed ?? 0, icon: BarChart3, accentColor: 'var(--color-primary)' },
          { title: 'Toplam Deneme', value: summary?.totalAttempts ?? 0, icon: Target, accentColor: 'var(--color-info)' },
          { title: 'Başarı Oranı', value: `%${summary?.overallPassRate ?? 0}`, icon: Award, accentColor: 'var(--color-success)' },
          { title: 'Ort. Kazanım', value: summary?.avgLearningGain != null ? `+${summary.avgLearningGain}` : '—', icon: TrendingUp, accentColor: 'var(--color-accent)' },
        ].map((s, i) => (
          <BlurFade key={s.title} delay={0.05 + i * 0.03}><StatCard {...s} /></BlurFade>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BlurFade delay={0.2} className="lg:col-span-2">
          <ChartCard title={period === 'monthly' ? 'Aylık Başarı Trendi' : 'Haftalık Başarı Trendi'} icon={<TrendingUp className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />}
            action={
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--color-bg)' }}>
                {([['monthly', 'Aylık'], ['weekly', 'Haftalık']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      background: period === key ? 'var(--color-surface)' : 'transparent',
                      color: period === key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      boxShadow: period === key ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <Calendar className="h-3 w-3" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="passRate" name="Başarı %" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="avgPostScore" name="Ort. Puan" fill="var(--color-info)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sınavlar tamamlandıkça başarı trendi burada görünecek.</div>}
            </div>
          </ChartCard>
        </BlurFade>

        <BlurFade delay={0.25}>
          <div className="rounded-2xl border p-6 h-full" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-bold mb-4">Kategori Bazlı</h3>
            {categories.length > 0 ? (
              <div className="space-y-3">
                {categories.map(c => (
                  <div key={c.category} className="flex items-center justify-between rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="text-sm font-semibold">{c.category}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{c.trainingCount} eğitim</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: c.passRate >= 70 ? 'var(--color-success)' : 'var(--color-error)' }}>%{c.passRate}</p>
                      {c.avgGain != null && <p className="text-[11px] font-mono" style={{ color: c.avgGain >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{c.avgGain >= 0 ? '+' : ''}{c.avgGain}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Kategori bazlı veriler eğitimler oluşturuldukça görünecek.</div>}
          </div>
        </BlurFade>
      </div>

      <BlurFade delay={0.3}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}><h3 className="text-sm font-bold">Eğitim Bazlı Etkinlik</h3></div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['Eğitim', 'Deneme', 'Ön Sınav', 'Son Sınav', 'Kazanım', 'Başarı'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainings.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{t.category ?? '—'}{t.isCompulsory ? ' · Zorunlu' : ''}</p>
                  </td>
                  <td className="px-5 py-3.5 font-mono">{t.totalAttempts}</td>
                  <td className="px-5 py-3.5 font-mono">{t.avgPreScore ?? '—'}</td>
                  <td className="px-5 py-3.5 font-mono font-bold">{t.avgPostScore ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    {t.avgLearningGain != null ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold" style={{ color: t.avgLearningGain >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {t.avgLearningGain >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {t.avgLearningGain >= 0 ? '+' : ''}{t.avgLearningGain}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: t.passRate >= 70 ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: t.passRate >= 70 ? 'var(--color-success)' : 'var(--color-error)' }}>%{t.passRate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trainings.length === 0 && <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>Eğitimlere sınav ekleyip personel atadıkça etkinlik analizi burada görünecek.</div>}
        </div>
      </BlurFade>
    </div>
  );
}
