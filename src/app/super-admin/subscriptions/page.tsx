'use client';

import { CreditCard, Plus, Check, Building2, Users, Database, Crown, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';

const plans = [
  {
    name: 'Başlangıç',
    slug: 'starter',
    icon: Zap,
    price: { monthly: 2999, annual: 29990 },
    limits: { staff: 100, trainings: 20, storage: 10 },
    features: ['Temel eğitim yönetimi', 'Sınav sistemi', 'E-posta bildirimleri', 'Temel raporlar'],
    color: 'var(--color-info)',
    hospitals: 4,
  },
  {
    name: 'Profesyonel',
    slug: 'pro',
    icon: Star,
    price: { monthly: 7999, annual: 79990 },
    limits: { staff: 500, trainings: 100, storage: 50 },
    features: ['Tüm Başlangıç özellikleri', 'Gelişmiş raporlar', 'Excel/PDF export', 'Audit log', 'Toplu personel import', 'Realtime bildirimler'],
    color: 'var(--color-accent)',
    hospitals: 6,
    popular: true,
  },
  {
    name: 'Kurumsal',
    slug: 'enterprise',
    icon: Crown,
    price: { monthly: 14999, annual: 149990 },
    limits: { staff: null, trainings: null, storage: 200 },
    features: ['Tüm Profesyonel özellikleri', 'Sınırsız personel', 'Sınırsız eğitim', 'Özel destek', 'API erişimi', 'Özel tema/marka', 'Yedekleme yönetimi', 'SLA garantisi'],
    color: 'var(--color-primary)',
    hospitals: 4,
  },
];

// Mock subscription status table
const hospitalSubscriptions = [
  { name: 'Devakent Hastanesi', code: 'DEV001', plan: 'Kurumsal', status: 'active', expiresAt: '22.03.2027', billing: 'Yıllık' },
  { name: 'Anadolu Sağlık', code: 'ANA002', plan: 'Profesyonel', status: 'active', expiresAt: '18.09.2026', billing: 'Yıllık' },
  { name: 'Başkent Tıp', code: 'BAS003', plan: 'Başlangıç', status: 'trial', expiresAt: '29.03.2026', billing: '-' },
  { name: 'Marmara Üni. H.', code: 'MAR004', plan: 'Kurumsal', status: 'active', expiresAt: '10.12.2026', billing: 'Yıllık' },
  { name: 'Ege Şifa', code: 'EGE005', plan: 'Profesyonel', status: 'active', expiresAt: '08.06.2026', billing: 'Aylık' },
  { name: 'Çukurova Devlet', code: 'CUK006', plan: 'Profesyonel', status: 'suspended', expiresAt: '-', billing: '-' },
  { name: 'Akdeniz H.', code: 'AKD007', plan: 'Başlangıç', status: 'expired', expiresAt: '25.02.2026', billing: '-' },
];

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
  return (
    <div className="space-y-8">
      <PageHeader
        title="Abonelik & Lisans Yönetimi"
        subtitle="Planları yönetin ve hastane aboneliklerini takip edin"
        action={{ label: 'Yeni Plan', icon: Plus }}
      />

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.slug}
              className="relative rounded-xl border p-6"
              style={{
                background: 'var(--color-surface)',
                borderColor: plan.popular ? plan.color : 'var(--color-border)',
                borderWidth: plan.popular ? '2px' : '1px',
                boxShadow: plan.popular ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              }}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: plan.color }}
                >
                  EN POPÜLER
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${plan.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: plan.color }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>{plan.name}</h3>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{plan.hospitals} hastane kullanıyor</span>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
                  ₺{plan.price.monthly.toLocaleString('tr-TR')}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}> /ay</span>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  veya ₺{plan.price.annual.toLocaleString('tr-TR')} /yıl
                </p>
              </div>

              <Separator className="my-4" style={{ background: 'var(--color-border)' }} />

              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <Users className="h-3.5 w-3.5" style={{ color: plan.color }} />
                  <span>{plan.limits.staff ? `${plan.limits.staff} personel` : 'Sınırsız personel'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <CreditCard className="h-3.5 w-3.5" style={{ color: plan.color }} />
                  <span>{plan.limits.trainings ? `${plan.limits.trainings} eğitim` : 'Sınırsız eğitim'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <Database className="h-3.5 w-3.5" style={{ color: plan.color }} />
                  <span>{plan.limits.storage} GB depolama</span>
                </div>
              </div>

              <Separator className="my-4" style={{ background: 'var(--color-border)' }} />

              <ul className="space-y-2 mb-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: plan.color }} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? 'default' : 'outline'}
                className="w-full font-semibold"
                style={plan.popular
                  ? { background: plan.color, color: 'white', transition: 'background var(--transition-fast)' }
                  : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', transition: 'border-color var(--transition-fast), color var(--transition-fast)' }
                }
              >
                Planı Düzenle
              </Button>
            </div>
          );
        })}
      </div>

      {/* Hospital Subscriptions Table */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="mb-4 text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          Hastane Abonelik Durumları
        </h3>
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
                const status = statusMap[sub.status];
                return (
                  <tr key={sub.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-3">
                      <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{sub.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{sub.code}</p>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: `${planColorMap[sub.plan]}15`, color: planColorMap[sub.plan] }}>
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
      </div>
    </div>
  );
}
