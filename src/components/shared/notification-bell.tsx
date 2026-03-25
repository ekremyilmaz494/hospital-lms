'use client';

import { useState } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface NotificationBellProps {
  notifications?: Notification[];
  unreadCount?: number;
}

const defaultNotifications: Notification[] = [
  { id: '1', title: 'Eğitim süresi yaklaşıyor', message: 'İş Güvenliği eğitiminin bitiş tarihi 2 gün sonra.', time: '2 saat önce', isRead: false, type: 'warning' },
  { id: '2', title: '3 personel başarısız', message: 'İş Güvenliği sınavında 3 personel başarısız oldu.', time: '5 saat önce', isRead: false, type: 'error' },
  { id: '3', title: 'Yeni personel eklendi', message: 'Hasan Kılıç başarıyla eklendi.', time: '1 gün önce', isRead: true, type: 'info' },
  { id: '4', title: 'Eğitim tamamlandı', message: 'El Hijyeni eğitimi %100 tamamlandı.', time: '2 gün önce', isRead: true, type: 'success' },
];

const typeColors: Record<string, string> = {
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  success: 'var(--color-success)',
};

export function NotificationBell({
  notifications = defaultNotifications,
  unreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const count = unreadCount ?? notifications.filter((n) => !n.isRead).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: 'var(--color-error)' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-xl)' }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-sm font-bold">Bildirimler</h4>
          {count > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--color-error)' }}>
              {count} yeni
            </span>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex gap-3 border-b px-4 py-3"
              style={{
                borderColor: 'var(--color-border)',
                background: n.isRead ? 'transparent' : 'var(--color-primary-light)',
              }}
            >
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: typeColors[n.type] }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{n.title}</p>
                <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                <p className="mt-1 text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{n.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-2.5 text-center" style={{ borderColor: 'var(--color-border)' }}>
          <a href="/admin/notifications" className="flex items-center justify-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
            Tüm Bildirimleri Gör <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
