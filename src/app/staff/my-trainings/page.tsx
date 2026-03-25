'use client';
import Link from 'next/link';
import { BookOpen, Clock, CheckCircle, XCircle, Lock, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const trainings = [
  { id: '1', title: 'İş Güvenliği Temel Eğitim', category: 'İş Güvenliği', status: 'in_progress', attempt: 1, maxAttempts: 3, deadline: '26.03.2026', progress: 40, daysLeft: 2 },
  { id: '2', title: 'Enfeksiyon Kontrol Eğitimi', category: 'Enfeksiyon', status: 'assigned', attempt: 0, maxAttempts: 3, deadline: '31.03.2026', progress: 0, daysLeft: 7 },
  { id: '3', title: 'El Hijyeni Eğitimi', category: 'Enfeksiyon', status: 'passed', attempt: 1, maxAttempts: 3, deadline: '15.02.2026', progress: 100, score: 90 },
  { id: '4', title: 'Hasta Hakları ve İletişim', category: 'Hasta Hakları', status: 'passed', attempt: 1, maxAttempts: 3, deadline: '28.02.2026', progress: 100, score: 95 },
  { id: '5', title: 'Radyoloji Güvenlik Protokolleri', category: 'Radyoloji', status: 'failed', attempt: 3, maxAttempts: 3, deadline: '10.03.2026', progress: 100, score: 55 },
];

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)', icon: BookOpen },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', icon: Clock },
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)', icon: CheckCircle },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)', icon: XCircle },
  locked: { label: 'Kilitli', bg: 'var(--color-error-bg)', text: 'var(--color-error)', icon: Lock },
};

const categoryColors: Record<string, string> = {
  'İş Güvenliği': 'var(--color-accent)', 'Enfeksiyon': 'var(--color-error)',
  'Hasta Hakları': 'var(--color-info)', 'Radyoloji': 'var(--color-primary)',
};

export default function MyTrainingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Eğitimlerim" subtitle="Atanan ve tamamlanan eğitimleriniz" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trainings.map((t) => {
          const sc = statusConfig[t.status] || statusConfig.assigned;
          const Icon = sc.icon;
          const catColor = categoryColors[t.category] || 'var(--color-primary)';
          return (
            <div key={t.id} className="group relative overflow-hidden rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)', transition: 'transform var(--transition-base), box-shadow var(--transition-base)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
              {/* Top color bar */}
              <div className="h-1" style={{ background: catColor }} />
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${catColor}15`, color: catColor }}>{t.category}</span>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: sc.bg, color: sc.text }}><Icon className="h-3 w-3" /> {sc.label}</span>
                </div>
                <h3 className="mb-2 text-base font-bold leading-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{t.title}</h3>
                <div className="mb-3 flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Deneme: <strong style={{ fontFamily: 'var(--font-mono)' }}>{t.attempt}/{t.maxAttempts}</strong></span>
                  <span>Son tarih: <strong style={{ fontFamily: 'var(--font-mono)' }}>{t.deadline}</strong></span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'var(--color-text-muted)' }}>İlerleme</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{t.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: sc.text, transition: 'width var(--transition-base)' }} />
                  </div>
                </div>

                {t.status === 'passed' && t.score && <p className="mb-3 text-xs" style={{ color: 'var(--color-success)' }}>Puan: <strong style={{ fontFamily: 'var(--font-mono)' }}>{t.score}%</strong></p>}
                {t.status === 'failed' && t.score && <p className="mb-3 text-xs" style={{ color: 'var(--color-error)' }}>Son puan: <strong style={{ fontFamily: 'var(--font-mono)' }}>{t.score}%</strong> (Kilitli)</p>}

                {t.daysLeft !== undefined && t.daysLeft <= 7 && t.status !== 'passed' && t.status !== 'failed' && (
                  <p className="mb-3 text-xs font-semibold" style={{ color: t.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-warning)' }}>{t.daysLeft} gün kaldı!</p>
                )}

                <Link href={`/staff/my-trainings/${t.id}`}>
                  <Button className="w-full gap-2 font-semibold" variant={t.status === 'assigned' || t.status === 'in_progress' ? 'default' : 'outline'} style={t.status === 'assigned' || t.status === 'in_progress' ? { background: 'var(--color-primary)', color: 'white', transition: 'background var(--transition-fast)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', transition: 'border-color var(--transition-fast)' }}>
                    {t.status === 'assigned' && <><Play className="h-4 w-4" /> Eğitime Başla</>}
                    {t.status === 'in_progress' && <><Play className="h-4 w-4" /> Devam Et</>}
                    {t.status === 'passed' && 'Detayları Gör'}
                    {t.status === 'failed' && 'Detayları Gör'}
                    {t.status === 'locked' && <><Lock className="h-4 w-4" /> Kilitli</>}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
