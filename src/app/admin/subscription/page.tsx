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

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

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
        <span className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>{label}</span>
        <span className="text-sm font-bold" style={{ color: isCritical ? K.ERROR : isWarning ? K.WARNING : K.TEXT_PRIMARY }}>
          {value.toLocaleString('tr-TR')} / {limit ? limit.toLocaleString('tr-TR') : '∞'}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: K.BORDER_LIGHT }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: limit ? `${percent}%` : '0%',
            backgroundColor: isCritical ? K.ERROR : isWarning ? K.WARNING : K.PRIMARY,
          }}
        />
      </div>
      {limit && <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED }}>%{percent} kullanıldı</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; Icon: typeof CheckCircle2 }> = {
    active:     { label: 'Aktif',        bg: K.SUCCESS_BG, color: K.SUCCESS,     Icon: CheckCircle2 },
    trial:      { label: 'Deneme',       bg: K.WARNING_BG, color: K.WARNING,     Icon: Clock },
    past_due:   { label: 'Gecikmiş',     bg: K.ERROR_BG,   color: K.ERROR,       Icon: AlertTriangle },
    cancelled:  { label: 'İptal',        bg: K.BORDER_LIGHT, color: K.TEXT_MUTED, Icon: AlertTriangle },
    paused:     { label: 'Duraklatıldı', bg: K.BORDER_LIGHT, color: K.TEXT_MUTED, Icon: Clock },
  };
  const cfg = map[status] ?? map['active'];
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon className="w-3 h-3" />
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
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: K.PRIMARY_LIGHT }}>
            <CreditCard className="w-8 h-8" style={{ color: K.PRIMARY }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>Aktif Abonelik Yok</h3>
          <p className="text-sm mb-6" style={{ color: K.TEXT_SECONDARY }}>
            Platformun tüm özelliklerine erişmek için bir plan seçin.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: K.PRIMARY }}
          >
            Planları İncele <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const { subscription, plan, usage, invoices } = data;
  const isActivePlan = subscription!.status === 'active' || subscription!.status === 'trial';

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
            className="px-5 py-4 flex items-center gap-3"
            style={{ backgroundColor: K.WARNING_BG, border: `1.5px solid ${K.WARNING}`, borderRadius: 14 }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: K.WARNING }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: K.WARNING }}>
                {subscription!.status === 'trial' ? 'Deneme süreniz bitiyor' : 'Aboneliğiniz sona eriyor'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: K.TEXT_SECONDARY }}>
                {daysLeftInfo.days} {daysLeftInfo.label}. Kesintisiz kullanım için aboneliğinizi yenileyin.
              </p>
            </div>
            <Link
              href="/demo"
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: K.WARNING }}
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
            accentColor={K.PRIMARY}
          />
          <StatCard
            title="Personel Kullanımı"
            value={`${usage!.staffCount} / ${usage!.staffLimit ?? '∞'}`}
            icon={Users}
            accentColor={K.INFO}
            trend={usage!.staffLimit ? { value: usage!.staffPercent, label: 'kapasite', isPositive: usage!.staffPercent < 80 } : undefined}
          />
          <StatCard
            title="Eğitim Kullanımı"
            value={`${usage!.trainingCount} / ${usage!.trainingLimit ?? '∞'}`}
            icon={GraduationCap}
            accentColor={K.ACCENT}
            trend={usage!.trainingLimit ? { value: usage!.trainingPercent, label: 'kapasite', isPositive: usage!.trainingPercent < 80 } : undefined}
          />
          <StatCard
            title="Abonelik Durumu"
            value={subscription!.status === 'trial' ? `${daysLeftInfo?.days ?? 0} gün deneme` : 'Aktif'}
            icon={Calendar}
            accentColor={daysLeftInfo?.urgent ? K.WARNING : K.SUCCESS}
          />
        </div>
      </BlurFade>

      {/* Ana içerik — Plan detayı + kullanım */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Plan kartı */}
        <BlurFade className="lg:col-span-1">
          <div
            className="p-6 h-full"
            style={{
              backgroundColor: isActivePlan ? K.PRIMARY_LIGHT : K.SURFACE,
              border: `1.5px solid ${isActivePlan ? K.PRIMARY : K.BORDER}`,
              borderRadius: 14,
              boxShadow: K.SHADOW_CARD,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: K.SURFACE }}>
                  <CreditCard className="w-5 h-5" style={{ color: K.PRIMARY }} />
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>{plan!.name}</h3>
                  <p className="text-xs capitalize" style={{ color: K.TEXT_MUTED }}>
                    {subscription!.billingCycle === 'monthly' ? 'Aylık' : subscription!.billingCycle === 'annual' ? 'Yıllık' : 'Özel'}
                  </p>
                </div>
              </div>
              <StatusBadge status={subscription!.status} />
            </div>

            {plan!.priceMonthly && (
              <div className="mb-5 pb-5 border-b" style={{ borderColor: K.BORDER_LIGHT }}>
                <span className="text-3xl font-black" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>
                  ₺{plan!.priceMonthly.toLocaleString('tr-TR')}
                </span>
                <span className="text-sm ml-1" style={{ color: K.TEXT_MUTED }}>/ay</span>
              </div>
            )}

            {subscription!.trialEndsAt && (
              <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                <Clock className="w-4 h-4" />
                Deneme bitiş: <span className="font-medium">{formatDate(subscription!.trialEndsAt)}</span>
              </div>
            )}
            {subscription!.expiresAt && !subscription!.trialEndsAt && (
              <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                <Calendar className="w-4 h-4" />
                Yenileme: <span className="font-medium">{formatDate(subscription!.expiresAt)}</span>
              </div>
            )}
            {subscription!.startedAt && (
              <div className="mb-5 flex items-center gap-2 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                <TrendingUp className="w-4 h-4" />
                Başlangıç: <span className="font-medium">{formatDate(subscription!.startedAt)}</span>
              </div>
            )}

            {Array.isArray(plan!.features) && plan!.features.length > 0 && (
              <ul className="space-y-2">
                {(plan!.features as string[]).slice(0, 8).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: K.PRIMARY }} />
                    {feat}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 pt-5 border-t" style={{ borderColor: K.BORDER_LIGHT }}>
              <Link
                href="/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: K.PRIMARY }}
              >
                Plan Yükseltme Talebi <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </BlurFade>

        {/* Kullanım metrikleri */}
        <BlurFade delay={0.05} className="lg:col-span-2">
          <div
            className="p-6 h-full"
            style={{ backgroundColor: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
          >
            <h3 className="mb-6" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700 }}>Kaynak Kullanımı</h3>
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
                    <span className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Depolama</span>
                    <span className="text-sm font-bold" style={{ color: K.TEXT_PRIMARY }}>
                      {plan!.maxStorageGb} GB dahil
                    </span>
                  </div>
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: K.BG, color: K.TEXT_SECONDARY }}>
                    Gerçek zamanlı depolama kullanımı yakında gösterilecek.
                  </div>
                </div>
              )}
            </div>

            {/* Limit aşımı uyarısı */}
            {(usage!.staffPercent >= 95 || usage!.trainingPercent >= 95) && (
              <div
                className="mt-6 rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: K.ERROR_BG, border: `1px solid ${K.ERROR}` }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: K.ERROR }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: K.ERROR }}>Kota Limitine Yaklaşıldı</p>
                  <p className="text-xs mt-0.5" style={{ color: K.TEXT_SECONDARY }}>
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
            style={{ backgroundColor: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD, overflow: 'hidden' }}
          >
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: K.BORDER_LIGHT }}>
              <FileText className="w-5 h-5" style={{ color: K.PRIMARY }} />
              <h3 style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700 }}>Fatura Geçmişi</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: K.BG }}>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Fatura No</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Dönem</th>
                    <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tarih</th>
                    <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}
                    >
                      <td className="px-6 py-3.5 text-sm font-mono" style={{ color: K.TEXT_PRIMARY }}>{inv.invoiceNumber}</td>
                      <td className="px-6 py-3.5 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                        {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                      </td>
                      <td className="px-6 py-3.5 text-sm" style={{ color: K.TEXT_SECONDARY }}>{formatDate(inv.issuedAt)}</td>
                      <td className="px-6 py-3.5 text-sm font-bold text-right" style={{ color: K.TEXT_PRIMARY }}>
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
