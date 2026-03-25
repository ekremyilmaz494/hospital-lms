'use client';

import { Bell, Send, Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  time: string;
  isRead: boolean;
}

const typeConfig: Record<string, { color: string; bg: string; icon: typeof Bell }> = {
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle },
  error: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Zap },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: Info },
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle },
};

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useFetch<Notification[]>('/api/admin/notifications');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const notifications = Array.isArray(data) ? data : (data as Record<string, unknown>)?.notifications as typeof data ?? [];
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.isRead).length : 0;

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/notifications/mark-all-read', { method: 'POST' });
      refetch();
    } catch { /* silent */ }
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
      refetch();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Bildirimler" subtitle="Sistem bildirimlerini görüntüle ve yönet" />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }} onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Tümünü Okundu İşaretle
          </Button>
          <ShimmerButton className="gap-2 text-sm font-semibold" borderRadius="12px" background="linear-gradient(135deg, #0d9668, #065f46)" shimmerColor="rgba(255,255,255,0.15)">
            <Send className="h-4 w-4" /> Bildirim Gönder
          </ShimmerButton>
        </div>
      </div>

      {unreadCount > 0 && (
        <BlurFade delay={0.05}>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={{ background: 'var(--color-primary-light)' }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--color-primary)' }}>
              <Bell className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm"><span className="font-bold" style={{ color: 'var(--color-primary)' }}>{unreadCount} okunmamış</span> bildiriminiz var</p>
          </div>
        </BlurFade>
      )}

      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((n, i) => {
            const cfg = typeConfig[n.type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <BlurFade key={n.id} delay={0.1 + i * 0.05}>
                <div className="group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-200" style={{ background: n.isRead ? 'var(--color-surface)' : cfg.bg, borderColor: 'var(--color-border)', boxShadow: n.isRead ? 'none' : 'var(--shadow-sm)' }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cfg.color}15` }}>
                    <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {!n.isRead && <AnimatedShinyText className="text-[10px] font-bold">Yeni</AnimatedShinyText>}
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                    <p className="mt-1.5 text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{n.time}</p>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" className="shrink-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ color: 'var(--color-text-muted)' }} onClick={() => markRead(n.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </BlurFade>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
      )}
    </div>
  );
}
