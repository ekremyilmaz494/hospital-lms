'use client';

import { useState } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/store/notification-store';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface NotificationBellProps {
  notifications?: NotificationItem[];
  unreadCount?: number;
}

const typeColors: Record<string, string> = {
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  success: 'var(--color-success)',
};

/** Format relative time from ISO date string */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export function NotificationBell({
  notifications: propNotifications,
  unreadCount: propUnreadCount,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { isAdmin, isSuperAdmin, isStaff } = useAuth();
  const store = useNotificationStore();

  // Map store notifications to display format, falling back to props
  const notifications: NotificationItem[] = propNotifications ?? store.notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: formatRelativeTime(n.createdAt),
    isRead: n.isRead,
    type: (n.type === 'warning' || n.type === 'error' || n.type === 'success' ? n.type : 'info') as NotificationItem['type'],
  }));

  const count = propUnreadCount ?? (propNotifications ? propNotifications.filter((n) => !n.isRead).length : store.unreadCount);

  // Dynamic link based on user role
  const notificationsHref = (isAdmin || isSuperAdmin) ? '/admin/notifications' : isStaff ? '/staff/notifications' : '/auth/login';

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
          <a href={notificationsHref} className="flex items-center justify-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
            Tüm Bildirimleri Gör <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
