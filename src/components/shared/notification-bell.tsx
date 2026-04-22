'use client';

import { useState } from 'react';
import { Bell, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/store/notification-store';

/**
 * Editorial chrome — hex sabit, dark mode'da flip yok (topbar ile uyumlu).
 * Memory: feedback_editorial_palette.md — chrome = hex sabit kuralı.
 */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#f4ead5';
const GOLD = '#c9a961';
const RULE = '#e0d7c0';
const OLIVE = '#1a3a28';
const CARD_BG = '#ffffff';

const FONT_MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const FONT_DISPLAY = 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif';

const TYPE_DOT: Record<string, string> = {
  info: '#2c55b8',
  warning: '#b4820b',
  error: '#b3261e',
  success: '#0a7a47',
};

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

  const notifications: NotificationItem[] = propNotifications ?? store.notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: formatRelativeTime(n.createdAt),
    isRead: n.isRead,
    type: (n.type === 'warning' || n.type === 'error' || n.type === 'success' ? n.type : 'info') as NotificationItem['type'],
  }));

  const count = propUnreadCount ?? (propNotifications ? propNotifications.filter((n) => !n.isRead).length : store.unreadCount);
  const notificationsHref = (isAdmin || isSuperAdmin) ? '/admin/notifications' : isStaff ? '/staff/notifications' : '/auth/login';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Bildirimler"
        className="relative inline-flex h-9 w-9 items-center justify-center transition-colors"
        style={{ color: INK_SOFT }}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span
            aria-live="polite"
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center px-1 text-[10px] font-bold"
            style={{
              backgroundColor: INK,
              color: CREAM,
              fontFamily: FONT_MONO,
              border: `1px solid ${GOLD}`,
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] p-0"
        style={{
          backgroundColor: CREAM,
          border: `1px solid ${INK}`,
          borderRadius: 0,
          boxShadow: '0 12px 32px rgba(10, 22, 40, 0.12)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }}
      >
        {/* ─── Masthead-lite ─── */}
        <div
          className="flex items-end justify-between gap-4 px-5 pt-4 pb-3 border-b"
          style={{ borderColor: INK }}
        >
          <h4
            className="text-[20px] leading-none font-semibold tracking-[-0.02em]"
            style={{ fontFamily: FONT_DISPLAY, color: INK }}
          >
            bildirim <span style={{ fontStyle: 'italic', color: OLIVE }}>merkezi</span>
            <span style={{ color: GOLD }}>.</span>
          </h4>
          {count > 0 && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em] tabular-nums shrink-0"
              style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
            >
              {String(count).padStart(2, '0')} yeni
            </span>
          )}
        </div>

        {/* ─── List ─── */}
        <div className="max-h-[340px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div
              className="px-5 py-10 text-center"
              style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
            >
              <p className="text-[11px] uppercase tracking-[0.2em]">Henüz bildirim yok</p>
            </div>
          ) : (
            notifications.map((n, idx) => (
              <div
                key={n.id}
                className="flex gap-3 px-5 py-3"
                style={{
                  borderTop: idx === 0 ? 'none' : `1px solid ${RULE}`,
                  backgroundColor: n.isRead ? 'transparent' : CARD_BG,
                }}
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0"
                  style={{ backgroundColor: TYPE_DOT[n.type] || TYPE_DOT.info, borderRadius: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color: INK, fontFamily: FONT_DISPLAY }}
                  >
                    {n.title}
                  </p>
                  <p
                    className="mt-1 text-[12px] leading-snug truncate"
                    style={{ color: INK_SOFT }}
                  >
                    {n.message}
                  </p>
                  <p
                    className="mt-1.5 text-[10px] uppercase tracking-[0.14em]"
                    style={{ fontFamily: FONT_MONO, color: INK_SOFT }}
                  >
                    {n.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── Footer link ─── */}
        <div
          className="px-5 py-3 border-t"
          style={{ borderColor: INK }}
        >
          <Link
            href={notificationsHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: INK, fontFamily: FONT_MONO }}
          >
            Tüm bildirimler
            <ArrowUpRight className="h-3.5 w-3.5" style={{ color: GOLD }} />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
