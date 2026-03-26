'use client';

import { useState } from 'react';
import {
  Bell, Send, Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap,
  Filter, Clock, Inbox, BellOff, Trash2, MailOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  time: string;
  isRead: boolean;
}

const typeConfig: Record<string, { color: string; bg: string; icon: typeof Bell; label: string }> = {
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle, label: 'Uyarı' },
  error: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Zap, label: 'Acil' },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: Info, label: 'Bilgi' },
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle, label: 'Başarılı' },
};

type FilterType = 'all' | 'unread' | 'warning' | 'error' | 'info' | 'success';

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<Notification[]>('/api/admin/notifications');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dismissing, setDismissing] = useState<string | null>(null);

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const notifications = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.notifications as typeof data) ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    return n.type === filter;
  });

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications/mark-all-read', { method: 'POST' });
      refetch();
      toast('Tüm bildirimler okundu olarak işaretlendi', 'success');
    } catch { /* silent */ }
  };

  const markRead = async (id: string) => {
    setDismissing(id);
    try {
      await fetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
      setTimeout(() => {
        refetch();
        setDismissing(null);
      }, 300);
    } catch {
      setDismissing(null);
    }
  };

  const filters: { id: FilterType; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'all', label: 'Tümü', icon: Inbox, count: notifications.length },
    { id: 'unread', label: 'Okunmamış', icon: Bell, count: unreadCount },
    { id: 'info', label: 'Bilgi', icon: Info },
    { id: 'warning', label: 'Uyarı', icon: AlertTriangle },
    { id: 'error', label: 'Acil', icon: Zap },
    { id: 'success', label: 'Başarılı', icon: CheckCircle },
  ];

  return (
    <div>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
              }}
            >
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Bildirimler
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Sistem olaylarını takip edin ve yönetin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                className="gap-2 rounded-xl h-10 text-[13px]"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={markAllRead}
              >
                <CheckCheck className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                Tümünü Oku
              </Button>
            )}
            <button
              className="flex items-center gap-2 rounded-xl h-10 px-5 text-[13px] font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
              }}
            >
              <Send className="h-4 w-4" />
              Bildirim Gönder
            </button>
          </div>
        </div>
      </BlurFade>

      {/* Unread banner */}
      {unreadCount > 0 && (
        <BlurFade delay={0.03}>
          <div
            className="flex items-center gap-4 rounded-2xl px-6 py-4 mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(13, 150, 104, 0.08), rgba(13, 150, 104, 0.02))',
              border: '1px solid rgba(13, 150, 104, 0.15)',
            }}
          >
            <div
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(13, 150, 104, 0.12)' }}
            >
              <Bell className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              <span
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: 'var(--color-primary)', boxShadow: '0 2px 6px rgba(13, 150, 104, 0.4)' }}
              >
                {unreadCount}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-[13px]">
                <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{unreadCount} okunmamış</span>
                {' '}bildiriminiz var
              </p>
            </div>
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors duration-150"
              style={{
                color: 'var(--color-primary)',
                background: 'rgba(13, 150, 104, 0.1)',
              }}
            >
              <MailOpen className="h-3.5 w-3.5" />
              Tümünü Oku
            </button>
          </div>
        </BlurFade>
      )}

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <BlurFade delay={0.05}>
          <div className="w-52 shrink-0 space-y-1">
            <div className="flex items-center gap-2 px-3 mb-3">
              <Filter className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Filtrele
              </span>
            </div>
            {filters.map((f) => {
              const isActive = filter === f.id;
              const typeConf = typeConfig[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200"
                  style={{
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    boxShadow: isActive ? '0 2px 8px rgba(13, 150, 104, 0.2)' : 'none',
                  }}
                >
                  <f.icon
                    className="h-4 w-4"
                    style={{
                      color: isActive ? 'white' : typeConf?.color || 'var(--color-text-muted)',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  <span className="flex-1 text-left">{f.label}</span>
                  {f.count !== undefined && f.count > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
                        color: isActive ? 'white' : 'var(--color-text-muted)',
                      }}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </BlurFade>

        {/* Notification list */}
        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((n, i) => {
                const cfg = typeConfig[n.type] || typeConfig.info;
                const Icon = cfg.icon;
                const isDismissing = dismissing === n.id;
                return (
                  <BlurFade key={n.id} delay={0.08 + i * 0.03}>
                    <div
                      className="group relative flex items-start gap-4 rounded-xl border p-5 transition-all duration-300"
                      style={{
                        background: n.isRead ? 'var(--color-surface)' : 'var(--color-surface)',
                        borderColor: n.isRead ? 'var(--color-border)' : `${cfg.color}25`,
                        borderLeftWidth: n.isRead ? '1px' : '3px',
                        borderLeftColor: n.isRead ? 'var(--color-border)' : cfg.color,
                        boxShadow: n.isRead ? 'none' : `0 2px 12px ${cfg.color}08`,
                        opacity: isDismissing ? 0 : 1,
                        transform: isDismissing ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                        style={{
                          background: `${cfg.color}10`,
                          border: `1px solid ${cfg.color}15`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <p className="text-[13px] font-semibold" style={{ color: n.isRead ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: `${cfg.color}12`, color: cfg.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[13px] leading-relaxed"
                          style={{ color: n.isRead ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
                        >
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {timeAgo(n.time)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {!n.isRead && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                            style={{ color: 'var(--color-primary)' }}
                            title="Okundu işaretle"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border py-20"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'var(--color-bg)' }}
              >
                <BellOff className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1">Bildirim bulunamadı</p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                {filter !== 'all' ? 'Bu filtreye uygun bildirim yok' : 'Henüz bildiriminiz bulunmuyor'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
