'use client';
import { BookOpen, Clock, CheckCircle, XCircle, Calendar, Bell, ArrowRight } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { PageHeader } from '@/components/shared/page-header';
import { AlertBanner } from '@/components/layouts/topbar/alert-banner';

const stats = [
  { title: 'Atanan Eğitim', value: 5, icon: BookOpen, accentColor: 'var(--color-info)' },
  { title: 'Devam Eden', value: 2, icon: Clock, accentColor: 'var(--color-warning)' },
  { title: 'Tamamlanan', value: 2, icon: CheckCircle, accentColor: 'var(--color-success)' },
  { title: 'Başarısız', value: 1, icon: XCircle, accentColor: 'var(--color-error)' },
];

const upcomingTrainings = [
  { title: 'İş Güvenliği Temel Eğitim', deadline: '26.03.2026', status: 'in_progress', daysLeft: 2 },
  { title: 'Enfeksiyon Kontrol', deadline: '31.03.2026', status: 'assigned', daysLeft: 7 },
  { title: 'Acil Durum Tahliye', deadline: '15.04.2026', status: 'assigned', daysLeft: 22 },
  { title: 'Laboratuvar Biyogüvenlik', deadline: '30.04.2026', status: 'assigned', daysLeft: 37 },
];

const recentActivity = [
  { text: 'El Hijyeni eğitimini başarıyla tamamladınız', time: '2 gün önce', type: 'success' },
  { text: 'Hasta Hakları son sınavında 95% aldınız', time: '5 gün önce', type: 'success' },
  { text: 'İş Güvenliği ön sınavını tamamladınız: 65%', time: '1 hafta önce', type: 'info' },
  { text: 'Radyoloji Güvenlik 2. deneme hakkınız açıldı', time: '2 hafta önce', type: 'warning' },
];

const notifications = [
  { title: 'İş Güvenliği bitiş tarihi yaklaşıyor', time: '1 saat önce', isRead: false },
  { title: 'Enfeksiyon Kontrol eğitimi atandı', time: '3 saat önce', isRead: false },
  { title: 'El Hijyeni sertifikanız hazır', time: '2 gün önce', isRead: true },
];

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

const typeColors: Record<string, string> = { success: 'var(--color-success)', info: 'var(--color-info)', warning: 'var(--color-warning)', error: 'var(--color-error)' };

export default function StaffDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Eğitim durumunuza genel bakış" />
      <AlertBanner message="İş Güvenliği Temel Eğitim bitiş tarihi 2 gün sonra! Eğitimi tamamlayın." actionLabel="Eğitime Git" actionHref="/staff/my-trainings/1" variant="error" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upcoming Trainings */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Calendar className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Yaklaşan Eğitimler</h3>
            </div>
            <a href="/staff/my-trainings" className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>Tümünü Gör <ArrowRight className="h-3 w-3" /></a>
          </div>
          <div className="space-y-3">
            {upcomingTrainings.map((t, i) => {
              const st = statusMap[t.status] || statusMap.assigned;
              return (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', transition: 'background var(--transition-fast)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg" style={{ background: t.daysLeft <= 3 ? 'var(--color-error-bg)' : 'var(--color-surface-hover)' }}>
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{t.deadline.split('.')[1] === '03' ? 'MAR' : 'NİS'}</span>
                    <span className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-mono)', color: t.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-text-primary)' }}>{t.deadline.split('.')[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Son tarih: {t.deadline}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                    {t.daysLeft <= 7 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: t.daysLeft <= 3 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: t.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-warning)' }}>{t.daysLeft} gün</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Notifications + Activity */}
        <div className="space-y-4">
          {/* Notifications */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
                <Bell className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Bildirimler</h3>
            </div>
            <div className="space-y-2">
              {notifications.map((n, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: !n.isRead ? 'var(--color-primary-light)' : 'transparent' }}>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--color-primary)' }} />}
                  <div className={!n.isRead ? '' : 'ml-4'}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                    <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-3 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Son Aktivitelerim</h3>
            <div className="space-y-3">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: typeColors[a.type] }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{a.text}</p>
                    <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
