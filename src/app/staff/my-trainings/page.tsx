'use client';

import Link from 'next/link';
import { BookOpen, Clock, CheckCircle, XCircle, Lock, Play, Target, Award } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Button } from '@/components/ui/button';
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
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof BookOpen }> = {
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)', icon: BookOpen },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', icon: Clock },
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)', icon: CheckCircle },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)', icon: XCircle },
  locked: { label: 'Kilitli', bg: 'var(--color-error-bg)', text: 'var(--color-error)', icon: Lock },
};

const categoryColors: Record<string, string> = {
  'İş Güvenliği': '#f59e0b', 'Enfeksiyon': '#dc2626',
  'Hasta Hakları': '#2563eb', 'Radyoloji': '#0d9668',
};

export default function MyTrainingsPage() {
  const { data: trainings, isLoading, error } = useFetch<Training[]>('/api/staff/my-trainings');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const trainingList = trainings ?? [];

  const miniStats = [
    { label: 'Toplam', value: trainingList.length, color: 'var(--color-text-primary)' },
    { label: 'Devam', value: trainingList.filter(t => t.status === 'in_progress').length, color: 'var(--color-warning)' },
    { label: 'Başarılı', value: trainingList.filter(t => t.status === 'passed').length, color: 'var(--color-success)' },
    { label: 'Başarısız', value: trainingList.filter(t => t.status === 'failed').length, color: 'var(--color-error)' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Eğitimlerim" subtitle="Atanan ve tamamlanan eğitimleriniz" />

      {/* Mini Stats */}
      <BlurFade delay={0.05}>
        <div className="flex items-center gap-6 rounded-2xl border px-6 py-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          {miniStats.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              {i > 0 && <div className="h-8 w-px" style={{ background: 'var(--color-border)' }} />}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Training Cards */}
      {trainingList.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {trainingList.map((t, idx) => {
          const sc = statusConfig[t.status] || statusConfig.assigned;
          const Icon = sc.icon;
          const catColor = categoryColors[t.category] || '#0d9668';
          const isActive = t.status === 'assigned' || t.status === 'in_progress';

          const CardWrapper = isActive ? MagicCard : ('div' as React.ElementType);
          const cardProps = isActive
            ? { gradientColor: `${catColor}15`, gradientOpacity: 0.5, className: 'rounded-2xl border overflow-hidden', style: { background: 'var(--color-surface)', borderColor: 'var(--color-border)' } }
            : { className: 'rounded-2xl border overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-1', style: { background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' } };

          return (
            <BlurFade key={t.id} delay={0.1 + idx * 0.06}>
              <div className="relative">
                {t.status === 'in_progress' && <BorderBeam size={80} duration={8} colorFrom={catColor} colorTo="var(--color-primary)" />}
                <CardWrapper {...cardProps}>
                  {/* Top accent */}
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${catColor}, ${catColor}60)` }} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${catColor}15`, color: catColor }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                        {t.category}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: sc.bg, color: sc.text }}>
                        <Icon className="h-3 w-3" /> {sc.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="mb-3 text-base font-bold leading-tight">{t.title}</h3>

                    {/* Meta */}
                    <div className="mb-4 flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Deneme: <strong className="font-mono">{t.attempt ?? 0}/{t.maxAttempts ?? 3}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <strong className="font-mono">{t.deadline}</strong>
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span style={{ color: 'var(--color-text-muted)' }}>İlerleme</span>
                        <span className="font-mono font-semibold">{t.progress ?? 0}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full" style={{ background: 'var(--color-border)' }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${t.progress ?? 0}%`, background: `linear-gradient(90deg, ${catColor}, ${sc.text})` }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    {t.status === 'passed' && t.score && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-success-bg)' }}>
                        <Award className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>Puan: <span className="font-mono">{t.score}%</span></span>
                      </div>
                    )}
                    {t.status === 'failed' && t.score && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-error-bg)' }}>
                        <XCircle className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>Son puan: <span className="font-mono">{t.score}%</span> (Kilitli)</span>
                      </div>
                    )}

                    {/* Days left warning */}
                    {t.daysLeft !== undefined && t.daysLeft <= 7 && isActive && (
                      <p className="mb-4 text-xs font-bold" style={{ color: t.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                        ⚡ {t.daysLeft} gün kaldı!
                      </p>
                    )}

                    {/* CTA Button */}
                    <Link href={`/staff/my-trainings/${t.id}`} className="block">
                      {isActive ? (
                        <ShimmerButton
                          className="w-full gap-2 text-sm font-semibold"
                          borderRadius="12px"
                          background={`linear-gradient(135deg, ${catColor}, ${catColor}cc)`}
                          shimmerColor="rgba(255,255,255,0.15)"
                        >
                          {t.status === 'assigned' ? <><Play className="h-4 w-4" /> Eğitime Başla</> : <><Play className="h-4 w-4" /> Devam Et</>}
                        </ShimmerButton>
                      ) : (
                        <Button className="w-full gap-2 rounded-xl text-sm" variant="outline" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          {t.status === 'passed' && 'Detayları Gör'}
                          {t.status === 'failed' && 'Detayları Gör'}
                          {t.status === 'locked' && <><Lock className="h-4 w-4" /> Kilitli</>}
                        </Button>
                      )}
                    </Link>
                  </div>
                </CardWrapper>
              </div>
            </BlurFade>
          );
        })}
      </div>
    </div>
  );
}
