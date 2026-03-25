'use client';
import { Bell, Send, Check, CheckCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const notifications = [
  { id: '1', title: 'Eğitim süresi yaklaşıyor', message: 'Enfeksiyon Kontrol eğitiminin bitiş tarihi 3 gün sonra.', type: 'warning', time: '2 saat önce', isRead: false },
  { id: '2', title: '3 personel sınavda başarısız', message: 'İş Güvenliği eğitiminde 3 personel baraj puanının altında kaldı.', type: 'error', time: '5 saat önce', isRead: false },
  { id: '3', title: 'Yeni personel eklendi', message: 'Hasan Kılıç sisteme başarıyla eklendi.', type: 'info', time: '1 gün önce', isRead: true },
  { id: '4', title: 'Eğitim tamamlandı', message: 'El Hijyeni eğitimi %100 tamamlandı.', type: 'success', time: '2 gün önce', isRead: true },
  { id: '5', title: 'Otomatik yedek alındı', message: 'Haftalık veritabanı yedeği başarıyla oluşturuldu.', type: 'info', time: '3 gün önce', isRead: true },
];

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', icon: 'var(--color-warning)' },
  error: { bg: 'var(--color-error-bg)', border: 'var(--color-error)', icon: 'var(--color-error)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)', icon: 'var(--color-info)' },
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', icon: 'var(--color-success)' },
};

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Bildirimler" subtitle="Sistem bildirimlerini görüntüle" />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><CheckCheck className="h-4 w-4" /> Tümünü Okundu İşaretle</Button>
          <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}><Send className="h-4 w-4" /> Bildirim Gönder</Button>
        </div>
      </div>
      <div className="space-y-3">
        {notifications.map((n) => {
          const s = typeStyles[n.type] || typeStyles.info;
          return (
            <div key={n.id} className="flex items-start gap-4 rounded-xl border p-4" style={{ background: n.isRead ? 'var(--color-surface)' : s.bg, borderColor: 'var(--color-border)', borderLeftWidth: '4px', borderLeftColor: s.border, boxShadow: 'var(--shadow-sm)' }}>
              <Bell className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.icon }} />
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
