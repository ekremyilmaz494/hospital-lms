'use client';

import { useMemo } from 'react';
import {
  CreditCard, Users, GraduationCap, Calendar, CheckCircle2, AlertTriangle,
  Clock, ArrowUpRight, TrendingUp, FileText, Zap,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { SectionError } from '@/components/shared/skeletons';

// ── Tip tanımları ──────────────────────────────────────────────────────────────

interface PlanData {
  id: string;
  name: string;
  slug: string;
  maxStaff: number | null;
  maxTrainings: number | null;
  maxStorageGb: number | null;
  priceMonthly: number | null;
  priceAnnual: number | null;
  features: string[];
}

interface SubscriptionData {
  status: string;
  billingCycle: string;
  startedAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
  trialDaysLeft: number | null;
}

interface UsageData {
  staffCount: number;
  staffLimit: number | null;
  staffPercent: number;
  trainingCount: number;
  trainingLimit: number | null;
  trainingPercent: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
}

interface SubscriptionResponse {
  hasSubscription: boolean;
  organization: string;
  subscription?: SubscriptionData;
  plan?: PlanData;
  usage?: UsageData;
  invoices?: Invoice[];
}

// ── Yardımcı bileşenler ────────────────────────────────────────────────────────

function UsageBar({ value, limit, label }: { value: number; limit: number | null; label: string }) {
  const percent = limit ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  const isWarning = percent >= 80;
  const isCritical = percent >= 95;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: isCritical ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
          {value.toLocaleString('tr-TR')} / {limit ? limit.toLocaleString('tr-TR') : '∞'}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: limit ? `${percent}%` : '0%',
            backgroundColor: isCritical ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : '#0d9668',
          }}
        />
      </div>
      {limit && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>%{percent} kullanıldı</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; Icon: typeof CheckCircle2 }> = {
    active:     { label: 'Aktif',      bg: 'rgba(16,185,129,0.1)',  color: '#10b981', Icon: CheckCircle2 },
    trial:      { label: 'Deneme',     bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b', Icon: Clock },
    past_due:   { label: 'Gecikmiş',   bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', Icon: AlertTriangle },
    cancelled:  { label: 'İptal',      bg: 'rgba(100,116,139,0.1)', color: '#64748b', Icon: AlertTriangle },
    paused:     { label: 'Duraklatıldı', bg: 'rgba(100,116,139,0.1)', color: '#64748b', Icon: Clock },
  };
  const cfg = map[status] ?? map['active'];
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(amount);
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { data, isLoading, error } = useFetch<SubscriptionResponse>('/api/admin/subscription');

  const daysLeftInfo = useMemo(() => {
    if (!data?.subscription) return null;
    const { status, daysLeft, trialDaysLeft } = data.subscription;
    if (status === 'trial' && trialDaysLeft !== null) {
      return { days: trialDaysLeft, label: 'deneme süresi kaldı', urgent: trialDaysLeft <= 5 };
    }
    if (daysLeft !== null) {
      return { days: daysLeft, label: 'gün kaldı', urgent: daysLeft <= 14 };
    }
    return null;
  }, [data]);

  if (isLoading) return <PageLoading />;
  if (error) return <SectionError message="Abonelik bilgileri yüklenemedi." onRetry={() => window.location.reload()} />;
  if (!data?.hasSubscription) {
    return (
      <div className="p-6 lg:p-8">
        <PageHeader title="Aboneliğim" subtitle="Mevcut plan ve kullanım bilgileriniz" />
        <div className="mt-8 max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(13,150,104,0.08)' }}>
            <CreditCard className="w-8 h-8" style={{ color: '#0d9668' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>Aktif Abonelik Yok</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Platformun tüm özelliklerine erişmek için bir plan seçin.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: '#0d9668' }}
          >
            Planları İncele <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const { subscription, plan, usage, invoices } = data;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Aboneliğim"
        subtitle={`${data.organization} — mevcut plan ve kullanım detayları`}
      />

      {/* Uyarı banner */}
      {daysLeftInfo?.urgent && (
        <BlurFade>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                {subscription!.status === 'trial' ? 'Deneme süreniz bitiyor' : 'Aboneliğiniz sona eriyor'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {daysLeftInfo.days} {daysLeftInfo.label}. Kesintisiz kullanım için aboneliğinizi yenileyin.
              </p>
            </div>
            <Link
              href="/demo"
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: '#f59e0b', color: '#0f172a' }}
            >
              Yükselt
            </Link>
          </div>
        </BlurFade>
      )}

      {/* Özet istatistikler */}
      <BlurFade>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Mevcut Plan"
            value={plan!.name}
            icon={Zap}
            accentColor="#0d9668"
          />
          <StatCard
            title="Personel Kullanımı"
            value={`${usage!.staffCount} / ${usage!.staffLimit ?? '∞'}`}
            icon={Users}
            accentColor="#3b82f6"
            trend={usage!.staffLimit ? { value: usage!.staffPercent, label: 'kapasite', isPositive: usage!.staffPercent < 80 } : undefined}
          />
          <StatCard
            title="Eğitim Kullanımı"
            value={`${usage!.trainingCount} / ${usage!.trainingLimit ?? '∞'}`}
            icon={GraduationCap}
            accentColor="#8b5cf6"
            trend={usage!.trainingLimit ? { value: usage!.trainingPercent, label: 'kapasite', isPositive: usage!.trainingPercent < 80 } : undefined}
          />
          <StatCard
            title="Abonelik Durumu"
            value={subscription!.status === 'trial' ? `${daysLeftInfo?.days ?? 0} gün deneme` : 'Aktif'}
            icon={Calendar}
            accentColor={daysLeftInfo?.urgent ? '#f59e0b' : '#10b981'}
          />
        </div>
      </BlurFade>

      {/* Ana içerik — Plan detayı + kullanım */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Plan kartı */}
        <BlurFade className="lg:col-span-1">
          <div
            className="rounded-2xl border p-6 h-full"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(13,150,104,0.08)' }}>
                  <CreditCard className="w-5 h-5" style={{ color: '#0d9668' }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{plan!.name}</h3>
                  <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                    {subscription!.billingCycle === 'monthly' ? 'Ayl\u0131k' : subscription!.billingCycle === 'annual' ? 'Y\u0131ll\u0131k' : '\u00d6zel'}
                  </p>
                </div>
              </div>
              <StatusBadge status={subscription!.status} />
            </div>

            {plan!.priceMonthly && (
              <div className="mb-5 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-3xl font-black" style={{ color: 'var(--color-text-primary)' }}>
                  ₺{plan!.priceMonthly.toLocaleString('tr-TR')}
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--color-text-muted)' }}>/ay</span>
              </div>
            )}

            {subscription!.trialEndsAt && (
              <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="w-4 h-4" />
                Deneme bitiş: <span className="font-medium">{formatDate(subscription!.trialEndsAt)}</span>
              </div>
            )}
            {subscription!.expiresAt && !subscription!.trialEndsAt && (
              <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Calendar className="w-4 h-4" />
                Yenileme: <span className="font-medium">{formatDate(subscription!.expiresAt)}</span>
              </div>
            )}
            {subscription!.startedAt && (
              <div className="mb-5 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <TrendingUp className="w-4 h-4" />
                Başlangıç: <span className="font-medium">{formatDate(subscription!.startedAt)}</span>
              </div>
            )}

            {Array.isArray(plan!.features) && plan!.features.length > 0 && (
              <ul className="space-y-2">
                {(plan!.features as string[]).slice(0, 8).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#0d9668' }} />
                    {feat}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <Link
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(13,150,104,0.08)', color: '#0d9668' }}
              >
                Plan Yükseltme Talebi <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </BlurFade>

        {/* Kullanım metrikleri */}
        <BlurFade delay={0.05} className="lg:col-span-2">
          <div
            className="rounded-2xl border p-6 h-full"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <h3 className="font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Kaynak Kullanımı</h3>
            <div className="space-y-6">
              <UsageBar
                value={usage!.staffCount}
                limit={usage!.staffLimit}
                label="Personel Hesabı"
              />
              <UsageBar
                value={usage!.trainingCount}
                limit={usage!.trainingLimit}
                label="Eğitim İçeriği"
              />
              {plan!.maxStorageGb && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Depolama</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {plan!.maxStorageGb} GB dahil
                    </span>
                  </div>
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                    Gerçek zamanlı depolama kullanımı yakında gösterilecek.
                  </div>
                </div>
              )}
            </div>

            {/* Limit aşımı uyarısı */}
            {(usage!.staffPercent >= 95 || usage!.trainingPercent >= 95) && (
              <div
                className="mt-6 rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Kota Limitine Yaklaşıldı</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Limitin %95&apos;ini geçtiniz. Kesinti yaşamamak için planınızı yükseltin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </BlurFade>
      </div>

      {/* Fatura geçmişi */}
      {invoices && invoices.length > 0 && (
        <BlurFade delay={0.1}>
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
              <FileText className="w-5 h-5" style={{ color: '#0d9668' }} />
              <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Fatura Geçmişi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg)' }}>
                    <th className="px-6 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Fatura No</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Dönem</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Tarih</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr
                      key={inv.id}
                      className="border-t"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: i % 2 !== 0 ? 'var(--color-bg)' : 'transparent' }}
                    >
                      <td className="px-6 py-3.5 text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>{inv.invoiceNumber}</td>
                      <td className="px-6 py-3.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                      </td>
                      <td className="px-6 py-3.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatDate(inv.issuedAt)}</td>
                      <td className="px-6 py-3.5 text-sm font-bold text-right" style={{ color: 'var(--color-text-primary)' }}>
                        {formatCurrency(inv.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
