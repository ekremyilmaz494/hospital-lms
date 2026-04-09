'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen, Clock, CheckCircle, XCircle, Lock, Play, Target, Award,
  ArrowRight, Zap, TrendingUp, BarChart3, AlertTriangle, ClipboardCheck,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface Training {
  id: string;
  title: string;
  category: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  deadline: string;
  progress: number;
  daysLeft?: number;
  score?: number;
  examOnly?: boolean;
  questionCount?: number;
  examDurationMinutes?: number;
  passingScore?: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof BookOpen }> = {
  assigned: { label: 'Atandı', color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: BookOpen },
  in_progress: { label: 'Devam Ediyor', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: Clock },
  passed: { label: 'Başarılı', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle },
  failed: { label: 'Başarısız', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: XCircle },
  locked: { label: 'Kilitli', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Lock },
};

const categoryColors: Record<string, string> = {
  'İş Güvenliği': '#f59e0b',
  'Enfeksiyon': '#dc2626',
  'Hasta Hakları': '#2563eb',
  'Radyoloji': '#0d9668',
  'enfeksiyon': '#dc2626',
};

function getCatColor(category: string): string {
  return categoryColors[category] || '#0d9668';
}

export default function MyTrainingsPage() {
  const { data: rawData, isLoading, error } = useFetch<{ data: Training[] } | Training[]>('/api/staff/my-trainings');
  const [activeTab, setActiveTab] = useState<'trainings' | 'exams'>('trainings');
  const completedRef = useRef<HTMLDivElement>(null);

  const allItems: Training[] = useMemo(
    () => Array.isArray(rawData) ? rawData : (rawData as { data: Training[] })?.data ?? [],
    [rawData]
  );

  const { trainingList, examCount, trainingCount, activeTrainings, exhaustedTrainings, completedTrainings, stats } = useMemo(() => {
    const list = allItems.filter((t) => activeTab === 'exams' ? t.examOnly : !t.examOnly);
    const isExhaustedFailed = (t: Training) => t.status === 'failed' && t.attempt >= t.maxAttempts;
    const active = list.filter(t => (t.status === 'assigned' || t.status === 'in_progress' || t.status === 'failed') && !isExhaustedFailed(t));
    const exhausted = list.filter(t => isExhaustedFailed(t));
    const completed = list.filter(t => t.status === 'passed' || t.status === 'locked');
    const passedCount = list.filter(t => t.status === 'passed').length;
    const scores = list.filter(t => t.score).map(t => t.score!);
    const avgScore = scores.length ? `%${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}` : '—';

    return {
      trainingList: list,
      examCount: allItems.filter((t) => t.examOnly).length,
      trainingCount: allItems.filter((t) => !t.examOnly).length,
      activeTrainings: active,
      exhaustedTrainings: exhausted,
      completedTrainings: completed,
      stats: [
        { label: 'Toplam Eğitim', value: list.length, icon: BookOpen, color: 'var(--color-primary)' },
        { label: 'Devam Eden', value: active.length, icon: Zap, color: 'var(--color-warning)' },
        { label: 'Tamamlanan', value: passedCount, icon: TrendingUp, color: 'var(--color-success)' },
        { label: 'Ortalama', value: avgScore, icon: BarChart3, color: 'var(--color-info)' },
      ],
    };
  }, [allItems, activeTab]);

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-4 mb-5 sm:mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
            }}
          >
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Eğitimlerim
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Atanan ve tamamlanan eğitimlerinizi takip edin
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Tab Switcher */}
      <BlurFade delay={0.02}>
        <div className="flex gap-1 rounded-xl p-1 mb-6" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('trainings')}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold flex-1 justify-center"
            style={{
              background: activeTab === 'trainings' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'trainings' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: activeTab === 'trainings' ? 'var(--shadow-sm)' : 'none',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            <BookOpen className="h-4 w-4" />
            Eğitimlerim
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: activeTab === 'trainings' ? 'var(--color-primary-light)' : 'var(--color-bg)', color: activeTab === 'trainings' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              {trainingCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold flex-1 justify-center"
            style={{
              background: activeTab === 'exams' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'exams' ? 'var(--color-accent)' : 'var(--color-text-muted)',
              boxShadow: activeTab === 'exams' ? 'var(--shadow-sm)' : 'none',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            Sınavlarım
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: activeTab === 'exams' ? 'var(--color-accent-light)' : 'var(--color-bg)', color: activeTab === 'exams' ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {examCount}
            </span>
          </button>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 sm:mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {s.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}12` }}>
                  <s.icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Tamamlanan Eğitimler kısayol butonu */}
      {completedTrainings.length > 0 && (
        <BlurFade delay={0.04}>
          <button
            onClick={() => completedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full flex items-center justify-between rounded-2xl border px-5 py-3.5 mb-6 transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'var(--color-success-bg)',
              borderColor: 'rgba(5,150,105,0.25)',
              boxShadow: '0 2px 8px rgba(5,150,105,0.08)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
              <span className="text-[13px] font-semibold" style={{ color: 'var(--color-success)' }}>
                Tamamlanan Eğitimler
              </span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-success)' }}>
                {completedTrainings.length}
              </span>
            </div>
            <ArrowRight className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
          </button>
        </BlurFade>
      )}

      {/* Active Trainings */}
      {activeTrainings.length > 0 && (
        <>
          <BlurFade delay={0.06}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
              <h2 className="text-sm sm:text-base font-bold">Aktif Eğitimler</h2>
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-warning)' }}>
                {activeTrainings.length}
              </span>
            </div>
          </BlurFade>

          <div className="space-y-4 mb-8">
            {activeTrainings.map((t, i) => {
              const sc = statusConfig[t.status] || statusConfig.assigned;
              const catColor = getCatColor(t.category);
              return (
                <BlurFade key={t.id} delay={0.08 + i * 0.04}>
                  <Link href={`/staff/my-trainings/${t.id}`} className="block group">
                    <div
                      className="relative rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Left accent */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: `linear-gradient(180deg, ${catColor}, ${catColor}80)` }} />

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6 pl-6 sm:pl-8">
                        {/* Icon */}
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${catColor}15, ${catColor}08)`,
                            border: `1px solid ${catColor}20`,
                          }}
                        >
                          {t.examOnly ? <ClipboardCheck className="h-6 w-6" style={{ color: catColor }} /> : <BookOpen className="h-6 w-6" style={{ color: catColor }} />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${catColor}12`, color: catColor }}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                              {t.category}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: sc.bg, color: sc.color }}>
                              <sc.icon className="h-3 w-3" />
                              {sc.label}
                            </span>
                          </div>
                          <h3 className="text-[15px] font-bold mb-2">{t.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-5 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                            {t.examOnly && (
                              <span className="flex items-center gap-1">
                                <ClipboardCheck className="h-3 w-3" />
                                {t.questionCount} soru · {t.examDurationMinutes} dk · Baraj: {t.passingScore}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              Deneme: <strong className="font-mono ml-0.5">{t.attempt ?? 0}/{t.maxAttempts ?? 3}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <strong className="font-mono">{t.deadline}</strong>
                            </span>
                            {t.daysLeft !== undefined && t.daysLeft <= 7 && (
                              <span className="font-bold" style={{ color: t.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                                {t.daysLeft} gün kaldı!
                              </span>
                            )}
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="flex items-center shrink-0 w-full sm:w-auto">
                          <div
                            className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white transition-transform duration-200 group-hover:scale-[1.03] w-full sm:w-auto"
                            style={{
                              background: `linear-gradient(135deg, ${catColor}, ${catColor}cc)`,
                              boxShadow: `0 4px 12px ${catColor}30`,
                            }}
                          >
                            <Play className="h-4 w-4" />
                            {t.status === 'assigned' ? 'Başla' : 'Devam Et'}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </BlurFade>
              );
            })}
          </div>
        </>
      )}

      {/* Exhausted / Failed Trainings — tüm haklar tükenmiş */}
      {exhaustedTrainings.length > 0 && (
        <>
          <BlurFade delay={0.10}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
              <h2 className="text-[14px] font-bold">Başarısız Eğitimler</h2>
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-error)' }}>
                {exhaustedTrainings.length}
              </span>
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 mb-8">
            {exhaustedTrainings.map((t, i) => {
              const catColor = getCatColor(t.category);
              return (
                <BlurFade key={t.id} delay={0.12 + i * 0.04}>
                  <Link href={`/staff/my-trainings/${t.id}`} className="block group">
                    <div
                      className="rounded-xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-error)',
                        borderLeftWidth: '3px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${catColor}12`, color: catColor }}>
                          {t.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                          <XCircle className="h-3 w-3" />
                          Haklar Tükendi
                        </span>
                      </div>
                      <h3 className="text-[14px] font-bold mb-3">{t.title}</h3>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="font-mono">{t.deadline}</span>
                          <span>Deneme: {t.attempt}/{t.maxAttempts}</span>
                        </div>
                        {t.score !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />
                            <span className="text-[14px] font-bold font-mono" style={{ color: 'var(--color-error)' }}>{t.score}%</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        Ek deneme hakkı için eğitim yöneticinize başvurun.
                      </p>
                    </div>
                  </Link>
                </BlurFade>
              );
            })}
          </div>
        </>
      )}


      {/* Completed Trainings — sayfa sonu */}
      {completedTrainings.length > 0 && (
        <div ref={completedRef}>
          <BlurFade delay={0.12}>
            <div className="flex items-center gap-2 mb-4 mt-4">
              <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
              <h2 className="text-[14px] font-bold">Tamamlanan Eğitimler</h2>
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-success)' }}>
                {completedTrainings.length}
              </span>
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {completedTrainings.map((t, i) => {
              const sc = statusConfig[t.status] || statusConfig.assigned;
              const catColor = getCatColor(t.category);
              const scoreColor = (t.score ?? 0) >= 80 ? 'var(--color-success)' : (t.score ?? 0) >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
              return (
                <BlurFade key={t.id} delay={0.14 + i * 0.04}>
                  <Link href={`/staff/my-trainings/${t.id}`} className="block group">
                    <div
                      className="rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                        opacity: t.status === 'locked' ? 0.6 : 1,
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${catColor}12`, color: catColor }}>
                          {t.category}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: sc.bg, color: sc.color }}>
                          <sc.icon className="h-3 w-3" />
                          {sc.label}
                        </span>
                      </div>
                      <h3 className="text-[14px] font-bold mb-3">{t.title}</h3>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="font-mono">{t.deadline}</span>
                          <span>Deneme: {t.attempt}/{t.maxAttempts}</span>
                        </div>
                        {t.score !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5" style={{ color: scoreColor }} />
                            <span className="text-[14px] font-bold font-mono" style={{ color: scoreColor }}>{t.score}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </BlurFade>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {trainingList.length === 0 && (
        <BlurFade delay={0.06}>
          <div
            className="flex flex-col items-center justify-center rounded-2xl border py-20"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <BookOpen className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[14px] font-semibold mb-1">Henüz eğitiminiz yok</p>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              Size eğitim atandığında burada görünecek
            </p>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
