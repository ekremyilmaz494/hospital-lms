'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
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
  error: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Zap },
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: Info },
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle },
};

export default function StaffNotificationsPage() {
  const { data, isLoading, error, refetch } = useFetch<Notification[]>('/api/staff/notifications');
  const [markingAll, setMarkingAll] = useState(false);

  const notifications = data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/staff/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      refetch();
    } catch {
      // silent fail
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/staff/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead: true }),
      });
      refetch();
    } catch {
      // silent fail
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Bildirimler" subtitle="Eğitim bildirimleri ve hatırlatmalar" />
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          onClick={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
        >
          <CheckCheck className="h-4 w-4" /> Tümünü Okundu İşaretle
        </Button>
      </div>

      {unreadCount > 0 && (
        <BlurFade delay={0.05}>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={{ background: 'var(--color-primary-light)', border: '1px solid rgba(var(--color-primary-rgb), 0.2)' }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--color-primary)' }}>
              <Bell className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-medium">
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{unreadCount} okunmamış</span>
              <span style={{ color: 'var(--color-text-secondary)' }}> bildiriminiz var</span>
            </p>
          </div>
        </BlurFade>
      )}

      <div className="space-y-3">
        {notifications.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</p>
        )}
        {notifications.map((n, i) => {
          const cfg = typeConfig[n.type] || typeConfig.info;
          const Icon = cfg.icon;
          return (
            <BlurFade key={n.id} delay={0.1 + i * 0.05}>
              <div
                className="group flex items-start gap-4 rounded-2xl border p-5 transition-all duration-200"
                style={{
                  background: n.isRead ? 'var(--color-surface)' : cfg.bg,
                  borderColor: n.isRead ? 'var(--color-border)' : 'var(--color-border)',
                  boxShadow: n.isRead ? 'none' : 'var(--shadow-sm)',
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cfg.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {!n.isRead && (
                      <AnimatedShinyText className="text-[10px] font-bold">
                        Yeni
                      </AnimatedShinyText>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                  <p className="mt-1.5 text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{n.time}</p>
                </div>
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </BlurFade>
          );
        })}
      </div>
    </div>
  );
}
