'use client';

import { CreditCard, Plus, Check, Building2, Users, Database, Crown, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface Plan {
  name: string;
  slug: string;
  icon: string;
  price: { monthly: number; annual: number };
  limits: { staff: number | null; trainings: number | null; storage: number };
  features: string[];
  color: string;
  hospitals: number;
  popular?: boolean;
}

interface HospitalSubscription {
  name: string;
  code: string;
  plan: string;
  status: string;
  expiresAt: string;
  billing: string;
}

interface SubscriptionsData {
  plans: Plan[];
  hospitalSubscriptions: HospitalSubscription[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Zap, Star, Crown,
};

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktif', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  trial: { label: 'Deneme', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  suspended: { label: 'Askıda', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  expired: { label: 'Süresi Doldu', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

const planColorMap: Record<string, string> = {
  'Başlangıç': 'var(--color-info)',
  'Profesyonel': 'var(--color-accent)',
  'Kurumsal': 'var(--color-primary)',
};

export default function SubscriptionsPage() {
  const { data, isLoading, error } = useFetch<SubscriptionsData>('/api/super-admin/subscriptions');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const plans = data?.plans ?? [];
  const hospitalSubscriptions = data?.hospitalSubscriptions ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Abonelik & Lisans Yönetimi"
        subtitle="Planları yönetin ve hastane aboneliklerini takip edin"
        action={{ label: 'Yeni Plan', icon: Plus }}
      />

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = iconMap[plan.icon] ?? Zap;
            const color = plan.color || planColorMap[plan.name] || 'var(--color-info)';
            return (
              <div
                key={plan.slug}
                className="relative rounded-xl border p-6"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: plan.popular ? color : 'var(--color-border)',
                  borderWidth: plan.popular ? '2px' : '1px',
                  boxShadow: plan.popular ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: color }}
                  >
                    EN POPÜLER
                  </span>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{plan.hospitals ?? 0} hastane kullanıyor</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold font-heading">
                    ₺{(plan.price?.monthly ?? 0).toLocaleString('tr-TR')}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}> /ay</span>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    veya ₺{(plan.price?.annual ?? 0).toLocaleString('tr-TR')} /yıl
                  </p>
                </div>

                <Separator className="my-4" style={{ background: 'var(--color-border)' }} />

                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <Users className="h-3.5 w-3.5" style={{ color }} />
                    <span>{plan.limits?.staff ? `${plan.limits.staff} personel` : 'Sınırsız personel'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <CreditCard className="h-3.5 w-3.5" style={{ color }} />
                    <span>{plan.limits?.trainings ? `${plan.limits.trainings} eğitim` : 'Sınırsız eğitim'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <Database className="h-3.5 w-3.5" style={{ color }} />
                    <span>{plan.limits?.storage ?? 0} GB depolama</span>
                  </div>
                </div>

                <Separator className="my-4" style={{ background: 'var(--color-border)' }} />

                <ul className="space-y-2 mb-5">
                  {(plan.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full font-semibold"
                  style={plan.popular
                    ? { background: color, color: 'white', transition: 'background var(--transition-fast)' }
                    : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', transition: 'border-color var(--transition-fast), color var(--transition-fast)' }
                  }
                >
                  Planı Düzenle
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Hospital Subscriptions Table */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="mb-4 text-base font-bold">
          Hastane Abonelik Durumları
        </h3>
        {hospitalSubscriptions.length === 0 ? (
          <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Hastane</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Plan</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Faturalama</th>
                  <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bitiş Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {hospitalSubscriptions.map((sub) => {
                  const status = statusMap[sub.status] ?? statusMap.active;
                  return (
                    <tr key={sub.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="py-3">
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{sub.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{sub.code}</p>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: `${planColorMap[sub.plan] ?? 'var(--color-info)'}15`, color: planColorMap[sub.plan] ?? 'var(--color-info)' }}>
                          {sub.plan}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: status.bg, color: status.text }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.text }} />
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{sub.billing}</td>
                      <td className="py-3" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{sub.expiresAt}</td>
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
