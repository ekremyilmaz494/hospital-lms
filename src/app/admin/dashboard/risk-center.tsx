'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Shield, CalendarClock, Send, ShieldAlert, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertSkeleton } from '@/components/shared/skeletons';

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

interface OverdueTraining {
  assignmentId: string;
  trainingId: string;
  name: string;
  dept: string;
  training: string;
  dueDate: string;
  daysOverdue: number;
  color: string;
}

interface ComplianceAlert {
  training: string;
  regulatoryBody: string;
  daysLeft: number;
  complianceRate: number;
  status: string;
}

interface ExpiringCert {
  name: string;
  cert: string;
  expiryDate: string;
  daysLeft: number;
  status: string;
}

interface RiskCenterProps {
  overdueTrainings: OverdueTraining[];
  complianceAlerts: ComplianceAlert[];
  expiringCerts: ExpiringCert[];
  isLoading: boolean;
  sendingReminder: string | null;
  onSendReminder: (assignmentId: string, staffName: string) => void;
}

type TabKey = 'overdue' | 'compliance' | 'certs';

/**
 * Risk Merkezi — Compliance uyarıları, geciken eğitimler ve süresi yaklaşan
 * sertifikaları tek sekmeli card altında toplar. Aciliyet sırasına göre badge gösterir.
 */
export function RiskCenter({
  overdueTrainings,
  complianceAlerts,
  expiringCerts,
  isLoading,
  sendingReminder,
  onSendReminder,
}: RiskCenterProps) {
  const criticalCertsCount = useMemo(
    () => expiringCerts.filter(c => c.daysLeft <= 7).length,
    [expiringCerts],
  );

  const tabs: { key: TabKey; label: string; count: number; icon: typeof AlertTriangle; tone: string }[] = [
    { key: 'overdue',    label: 'Geciken Eğitimler', count: overdueTrainings.length, icon: AlertTriangle, tone: K.ERROR },
    { key: 'compliance', label: 'Uyum Alarmları',    count: complianceAlerts.length, icon: Shield,         tone: K.WARNING },
    { key: 'certs',      label: 'Sertifika Süreleri',count: expiringCerts.length,    icon: CalendarClock,  tone: K.INFO },
  ];

  const firstWithData = tabs.find(t => t.count > 0)?.key ?? 'overdue';
  const [active, setActive] = useState<TabKey>(firstWithData);
  const [open, setOpen] = useState(false);

  const totalRisk = overdueTrainings.length + complianceAlerts.length + criticalCertsCount;
  const totalItems = overdueTrainings.length + complianceAlerts.length + expiringCerts.length;

  if (isLoading) {
    return (
      <div
        className="px-4 py-3"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 14,
          boxShadow: K.SHADOW_CARD,
        }}
      >
        <div className="h-9 w-full animate-pulse rounded-lg" style={{ background: K.BG }} />
      </div>
    );
  }

  const hasUrgent = totalRisk > 0;
  const triggerIconBg = hasUrgent ? K.ERROR_BG : K.SUCCESS_BG;
  const triggerIconColor = hasUrgent ? '#b91c1c' : K.PRIMARY;
  const badgeBg = hasUrgent ? K.ERROR_BG : K.BG;
  const badgeColor = hasUrgent ? '#b91c1c' : K.TEXT_MUTED;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 14,
          boxShadow: K.SHADOW_CARD,
        }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: triggerIconBg }}>
          <ShieldAlert className="h-4.5 w-4.5" style={{ color: triggerIconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: K.TEXT_PRIMARY }}>Risk Merkezi</p>
          <p className="text-[11px] leading-tight truncate" style={{ color: K.TEXT_MUTED }}>
            {hasUrgent ? `${totalRisk} acil · ${totalItems} izlenen` : 'Aciliyet yok, izleme listesi'}
          </p>
        </div>
        <span
          className="inline-flex min-w-5.5 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {totalItems}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: K.TEXT_MUTED }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: triggerIconBg }}>
                <ShieldAlert className="h-5 w-5" style={{ color: triggerIconColor }} />
              </div>
              <div className="min-w-0">
                <DialogTitle
                  className="truncate"
                  style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}
                >
                  Risk Merkezi
                </DialogTitle>
                <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>
                  {hasUrgent ? `${totalRisk} acil madde bekliyor` : 'Aciliyet yok, izleme listesi'}
                </p>
              </div>
            </div>
            <Link
              href="/admin/reports"
              className="shrink-0 text-[11px] md:text-xs font-semibold"
              style={{ color: K.PRIMARY }}
              onClick={() => setOpen(false)}
            >
              Rapor →
            </Link>
          </div>

          <div
            className="flex gap-1 overflow-x-auto px-1 py-2 -mx-1"
            style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
          >
            {tabs.map(t => {
              const isActive = active === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(t.key)}
                  className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors duration-150"
                  style={{
                    background: isActive ? K.BG : 'transparent',
                    color: isActive ? t.tone : K.TEXT_MUTED,
                    border: isActive ? `1px solid ${K.BORDER_LIGHT}` : '1px solid transparent',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className="inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: isActive ? t.tone : K.BORDER_LIGHT,
                        color: isActive ? '#fff' : K.TEXT_SECONDARY,
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {active === 'overdue' && (
              overdueTrainings.length === 0 ? (
                <EmptyState icon={AlertTriangle} label="Geciken eğitim yok" />
              ) : (
                <OverdueList
                  items={overdueTrainings}
                  sendingReminder={sendingReminder}
                  onSendReminder={onSendReminder}
                />
              )
            )}

            {active === 'compliance' && (
              complianceAlerts.length === 0 ? (
                <EmptyState icon={Shield} label="Uyum alarmı yok" />
              ) : (
                <ComplianceList items={complianceAlerts} />
              )
            )}

            {active === 'certs' && (
              expiringCerts.length === 0 ? (
                <EmptyState icon={CalendarClock} label="Yaklaşan sertifika yok" />
              ) : (
                <CertsList items={expiringCerts} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: typeof AlertTriangle; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: K.BG }}>
        <Icon className="h-4 w-4" style={{ color: K.PRIMARY }} />
      </div>
      <p className="text-[12px]" style={{ color: K.TEXT_MUTED }}>{label}</p>
    </div>
  );
}

function OverdueList({
  items,
  sendingReminder,
  onSendReminder,
}: {
  items: OverdueTraining[];
  sendingReminder: string | null;
  onSendReminder: (assignmentId: string, staffName: string) => void;
}) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {items.map(t => (
          <div
            key={t.assignmentId}
            className="p-3"
            style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 14 }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>
                  {t.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{t.name}</p>
                <p className="text-[11px] truncate" style={{ color: K.TEXT_MUTED }}>{t.dept}</p>
              </div>
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: K.ERROR_BG, color: '#b91c1c' }}
              >
                {t.daysOverdue} gün
              </span>
            </div>
            <p className="text-[12px] mb-2 truncate" style={{ color: K.TEXT_SECONDARY }}>{t.training}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 rounded-lg text-xs"
              style={{ borderColor: K.PRIMARY, color: K.PRIMARY }}
              disabled={sendingReminder === t.assignmentId}
              onClick={() => onSendReminder(t.assignmentId, t.name)}
            >
              <Send className="h-3 w-3" />
              {sendingReminder === t.assignmentId ? 'Gönderiliyor...' : 'Hatırlat'}
            </Button>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr style={{ background: K.BG }}>
              <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>Personel</th>
              <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>Departman</th>
              <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>Eğitim</th>
              <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>Son Tarih</th>
              <th className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>Gecikme</th>
              <th className="px-4 py-3 text-right" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: K.TEXT_MUTED }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => (
              <tr key={t.assignmentId} className="clickable-row" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>
                        {t.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold" style={{ color: K.TEXT_PRIMARY }}>{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5" style={{ color: K.TEXT_SECONDARY }}>{t.dept}</td>
                <td className="px-4 py-3.5" style={{ color: K.TEXT_PRIMARY }}>{t.training}</td>
                <td className="px-4 py-3.5 font-mono text-xs" style={{ color: K.TEXT_MUTED }}>{t.dueDate}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 rounded-full" style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600, background: K.ERROR_BG, color: '#b91c1c' }}>
                    {t.daysOverdue} gün gecikmiş
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-lg text-xs"
                    style={{ borderColor: K.PRIMARY, color: K.PRIMARY }}
                    disabled={sendingReminder === t.assignmentId}
                    onClick={() => onSendReminder(t.assignmentId, t.name)}
                  >
                    <Send className="h-3 w-3" />
                    {sendingReminder === t.assignmentId ? 'Gönderiliyor...' : 'Hatırlat'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ComplianceList({ items }: { items: ComplianceAlert[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((alert, i) => {
        const isCritical = alert.status === 'critical' || alert.status === 'overdue';
        const tone = isCritical ? '#b91c1c' : '#b45309';
        const toneBg = isCritical ? K.ERROR_BG : K.WARNING_BG;
        return (
          <div
            key={i}
            className="flex items-start gap-3 p-3"
            style={{
              background: toneBg,
              border: `1px solid ${K.BORDER_LIGHT}`,
              borderRadius: 14,
            }}
          >
            <AlertTriangle
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: tone }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{alert.training}</p>
              {alert.regulatoryBody && (
                <p className="text-xs" style={{ color: K.TEXT_MUTED }}>{alert.regulatoryBody}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs font-bold"
                  style={{ color: tone }}
                >
                  {alert.status === 'overdue' ? 'Süre Doldu!' : `${alert.daysLeft} gün`}
                </span>
                <span className="text-xs" style={{ color: K.TEXT_MUTED }}>· %{alert.complianceRate} uyumlu</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CertsList({ items }: { items: ExpiringCert[] }) {
  return (
    <div className="space-y-3">
      {items.map(c => {
        const tone = c.status === 'critical' ? '#b91c1c' : c.status === 'warning' ? '#b45309' : K.PRIMARY;
        const toneBg = c.status === 'critical' ? K.ERROR_BG : c.status === 'warning' ? K.WARNING_BG : K.SUCCESS_BG;
        return (
          <div
            key={c.name}
            className="flex items-center gap-3 p-3 transition-colors duration-150"
            style={{ border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 14, background: K.SURFACE }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: toneBg }}>
              <CalendarClock className="h-5 w-5" style={{ color: tone }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: K.TEXT_PRIMARY }}>{c.name}</p>
              <p className="text-[11px] truncate" style={{ color: K.TEXT_MUTED }}>{c.cert}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>{c.expiryDate}</p>
              <p className="text-xs font-bold" style={{ color: tone }}>{c.daysLeft} gün</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
