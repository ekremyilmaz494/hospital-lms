'use client';

import { useState } from 'react';
import {
  Bell, Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap,
  BellOff, Clock, Filter,
} from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
}

const typeConfig: Record<string, { color: string; bg: string; icon: typeof Bell; label: string }> = {
  error: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Zap, label: 'Acil' },
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle, label: 'Uyarı' },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: Info, label: 'Bilgi' },
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle, label: 'Başarılı' },
};

type FilterType = 'all' | 'unread';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StaffNotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{ notifications: Notification[]; unreadCount: number }>('/api/staff/notifications');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // B8.4/G8.4 — Optimistic UI: API bitmeden önce UI'ı güncelle, hata varsa geri al
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const [optimisticAllRead, setOptimisticAllRead] = useState(false);

  const rawNotifications = data?.notifications ?? [];
  const rawUnreadCount = data?.unreadCount ?? 0;

  // Optimistic override uygula
  const allNotifications = rawNotifications.map(n =>
    optimisticAllRead || optimisticReadIds.has(n.id) ? { ...n, isRead: true } : n
  );
  const unreadCount = optimisticAllRead ? 0 : Math.max(0, rawUnreadCount - optimisticReadIds.size);
  const notifications = filter === 'unread'
    ? allNotifications.filter(n => !n.isRead)
    : allNotifications;

  const handleMarkAllRead = async () => {
    if (rawUnreadCount === 0) return;
    // Optimistic: sayacı ve kartları hemen güncelle
    setOptimisticAllRead(true);
    setMarkingAll(true);
    try {
      const res = await fetch('/api/staff/notifications', { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast('Tüm bildirimler okundu olarak işaretlendi', 'success');
      void refetch(); setOptimisticAllRead(false);
    } catch {
      setOptimisticAllRead(false); // Rollback
      toast('İşlem başarısız', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    // Optimistic: kartı hemen okunmuş göster
    setOptimisticReadIds(prev => new Set(prev).add(id));
    setMarkingId(id);
    try {
      const res = await fetch(`/api/staff/notifications?id=${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      void refetch(); setOptimisticReadIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {
      // Rollback
      setOptimisticReadIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast('İşlem başarısız', 'error');
    } finally {
      setMarkingId(null);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent), #d97706)',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)',
              }}
            >
              <Bell className="h-6 w-6 text-white" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: 'var(--color-error)', boxShadow: '0 0 0 2px var(--color-bg)' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Bildirimler
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Eğitim bildirimleri ve hatırlatmalar
              </p>
            </div>
          </div>
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            aria-label="Tümünü okundu işaretle"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 min-h-[44px] text-[13px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: unreadCount > 0 ? 'var(--color-primary-light)' : 'var(--color-bg)',
              color: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
              border: `1px solid ${unreadCount > 0 ? 'rgba(13, 150, 104, 0.2)' : 'var(--color-border)'}`,
            }}
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? 'İşaretleniyor...' : 'Tümünü Okundu İşaretle'}
          </button>
        </div>
      </BlurFade>

      {/* Filter + Summary */}
      <BlurFade delay={0.03}>
        <div
          className="flex items-center justify-between rounded-xl px-5 py-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg)' }}>
            {([
              { key: 'all' as const, label: `Tümü (${allNotifications.length})` },
              { key: 'unread' as const, label: `Okunmamış (${unreadCount})` },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-label={`Filtrele: ${f.label}`}
                aria-pressed={filter === f.key}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150"
                style={{
                  background: filter === f.key ? 'var(--color-primary)' : 'transparent',
                  color: filter === f.key ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {notifications.length} bildirim
          </span>
        </div>
      </BlurFade>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <BlurFade delay={0.06}>
            <div
              className="flex flex-col items-center justify-center rounded-2xl border py-16"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'var(--color-bg)' }}
              >
                <BellOff className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1">
                {filter === 'unread' ? 'Okunmamış bildirim yok' : 'Bildirimleriniz burada görünecek.'}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                {filter === 'unread'
                  ? 'Tüm bildirimleriniz okunmuş durumda'
                  : 'Eğitim atandığında veya sınav sonuçlandığında bildirim alacaksınız'}
              </p>
            </div>
          </BlurFade>
        ) : (
          notifications.map((n, i) => {
            const cfg = typeConfig[n.type] || typeConfig.info;
            const Icon = cfg.icon;
            const isMarking = markingId === n.id;
            return (
              <BlurFade key={n.id} delay={0.06 + i * 0.03}>
                <div
                  className="group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-200"
                  style={{
                    background: n.isRead ? 'var(--color-surface)' : `linear-gradient(135deg, ${cfg.bg}, var(--color-surface))`,
                    borderColor: n.isRead ? 'var(--color-border)' : `${cfg.color}25`,
                    boxShadow: n.isRead ? 'none' : 'var(--shadow-sm)',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                    style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[14px] font-semibold">{n.title}</p>
                      {!n.isRead && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
                          Yeni
                        </span>
                      )}
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase"
                        style={{ background: `${cfg.color}10`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                      <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Mark as read button */}
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      disabled={isMarking}
                      className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                      title="Okundu olarak işaretle"
                      aria-label="Okundu işaretle"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  {n.isRead && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                      <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-border)' }} />
                    </div>
                  )}
                </div>
              </BlurFade>
            );
          })
        )}
      </div>
    </div>
  );
}
