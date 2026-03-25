'use client';

import Link from 'next/link';
import { Building2, Calendar, ExternalLink, Clock, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFetch } from '@/hooks/use-fetch';

interface RecentHospital {
  id: string;
  name: string;
  code: string;
  registeredAt: string;
  staffCount: number;
  plan: string;
}

interface ExpiringSubscription {
  id: string;
  name: string;
  code: string;
  plan: string;
  expiresAt: string;
  daysLeft: number;
  status: string;
}

interface DashboardListsData {
  recentHospitals: RecentHospital[];
  expiringSubscriptions: ExpiringSubscription[];
}

const planColors: Record<string, string> = {
  'Başlangıç': 'var(--color-info)',
  'Profesyonel': 'var(--color-accent)',
  'Kurumsal': 'var(--color-primary)',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
};

export function DashboardLists() {
  const { data, isLoading, error } = useFetch<DashboardListsData>('/api/super-admin/dashboard');

  const recentHospitals = data?.recentHospitals ?? [];
  const expiringSubscriptions = data?.expiringSubscriptions ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Yükleniyor...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Recent Hospitals */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <Building2 className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3
              className="text-base font-bold"
            >
              Son Kayıt Olan Hastaneler
            </h3>
          </div>
          <Link
            href="/super-admin/hospitals"
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--color-primary)', transition: 'opacity var(--transition-fast)' }}
          >
            Tümünü Gör <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {recentHospitals.length === 0 ? (
          <div className="flex items-center justify-center h-24"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
        ) : (
          <div className="space-y-3">
            {recentHospitals.map((hospital, idx) => (
              <div
                key={hospital.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Rank Badge */}
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{
                    background: idx === 0 ? 'var(--color-accent)' : idx === 1 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {idx + 1}
                </div>

                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback
                    className="text-xs font-semibold text-white"
                    style={{ background: planColors[hospital.plan] || 'var(--color-primary)' }}
                  >
                    {hospital.name?.slice(0, 2).toUpperCase() ?? ''}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {hospital.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {hospital.code}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                    {hospital.staffCount ?? 0}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>personel</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expiring Subscriptions */}
      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-warning-bg)' }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
            </div>
            <h3
              className="text-base font-bold"
            >
              Aboneliği Sona Yaklaşan
            </h3>
          </div>
        </div>

        {expiringSubscriptions.length === 0 ? (
          <div className="flex items-center justify-center h-24"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Hastane</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Plan</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bitiş</th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kalan</th>
                </tr>
              </thead>
              <tbody>
                {expiringSubscriptions.map((sub) => {
                  const colors = statusColors[sub.status] ?? statusColors.info;
                  return (
                    <tr
                      key={sub.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td className="py-2.5">
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{sub.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub.code}</p>
                      </td>
                      <td className="py-2.5">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: `${planColors[sub.plan] ?? 'var(--color-info)'}15`, color: planColors[sub.plan] ?? 'var(--color-info)' }}
                        >
                          {sub.plan}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {sub.expiresAt}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          <Clock className="h-3 w-3" />
                          {sub.daysLeft ?? 0} gün
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
