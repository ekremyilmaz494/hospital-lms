'use client';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const notifications = [
  { id: '1', title: 'İş Güvenliği bitiş tarihi yaklaşıyor', message: 'Eğitimi 26.03.2026 tarihine kadar tamamlamanız gerekmektedir.', type: 'error', time: '1 saat önce', isRead: false },
  { id: '2', title: 'Enfeksiyon Kontrol eğitimi atandı', message: 'Yeni bir eğitim atandı. Son tarih: 31.03.2026', type: 'info', time: '3 saat önce', isRead: false },
  { id: '3', title: 'El Hijyeni eğitimini başarıyla tamamladınız', message: 'Tebrikler! 90% puan ile geçtiniz.', type: 'success', time: '2 gün önce', isRead: true },
  { id: '4', title: 'Hasta Hakları sınavı sonucu', message: '95% puan ile başarılı oldunuz.', type: 'success', time: '5 gün önce', isRead: true },
  { id: '5', title: 'Radyoloji Güvenlik yeni deneme hakkı', message: 'Admin tarafından yeni deneme hakkı verildi.', type: 'warning', time: '2 hafta önce', isRead: true },
];

const typeStyles: Record<string, { bg: string; border: string }> = {
  error: { bg: 'var(--color-error-bg)', border: 'var(--color-error)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)' },
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)' },
};

export default function StaffNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Bildirimler" subtitle="Eğitim bildirimleri ve hatırlatmalar" />
        <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><CheckCheck className="h-4 w-4" /> Tümünü Okundu İşaretle</Button>
      </div>
      <div className="space-y-3">
        {notifications.map((n) => {
          const s = typeStyles[n.type] || typeStyles.info;
          return (
            <div key={n.id} className="flex items-start gap-4 rounded-xl border p-4" style={{ background: n.isRead ? 'var(--color-surface)' : s.bg, borderColor: 'var(--color-border)', borderLeftWidth: '4px', borderLeftColor: s.border, boxShadow: 'var(--shadow-sm)' }}>
              <Bell className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.border }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                  {!n.isRead && <span className="h-2 w-2 rounded-full" style={{ background: s.border }} />}
                </div>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                <p className="mt-1 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{n.time}</p>
              </div>
              {!n.isRead && <Button variant="ghost" size="sm" style={{ color: 'var(--color-text-muted)' }}><Check className="h-4 w-4" /></Button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
