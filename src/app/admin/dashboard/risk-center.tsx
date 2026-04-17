'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Shield, CalendarClock, Send, ShieldAlert, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertSkeleton } from '@/components/shared/skeletons';

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
    { key: 'overdue',    label: 'Geciken Eğitimler', count: overdueTrainings.length, icon: AlertTriangle, tone: 'var(--color-error)' },
    { key: 'compliance', label: 'Uyum Alarmları',    count: complianceAlerts.length, icon: Shield,         tone: 'var(--color-warning)' },
    { key: 'certs',      label: 'Sertifika Süreleri',count: expiringCerts.length,    icon: CalendarClock,  tone: 'var(--color-info)' },
  ];

  const firstWithData = tabs.find(t => t.count > 0)?.key ?? 'overdue';
  const [active, setActive] = useState<TabKey>(firstWithData);
  const [open, setOpen] = useState(false);

  const totalRisk = overdueTrainings.length + complianceAlerts.length + criticalCertsCount;
  const totalItems = overdueTrainings.length + complianceAlerts.length + expiringCerts.length;

  if (isLoading) {
    return (
      <div className="rounded-xl border px-4 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="h-9 w-full animate-pulse rounded-lg" style={{ background: 'var(--color-bg)' }} />
      </div>
    );
  }

  const hasUrgent = totalRisk > 0;
  const triggerIconBg = hasUrgent ? 'var(--color-error-bg)' : 'var(--color-success-bg)';
  const triggerIconColor = hasUrgent ? 'var(--color-error)' : 'var(--color-success)';
  const badgeBg = hasUrgent ? 'var(--color-error-bg)' : 'var(--color-bg)';
  const badgeColor = hasUrgent ? 'var(--color-error)' : 'var(--color-text-muted)';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: triggerIconBg }}>
          <ShieldAlert className="h-4.5 w-4.5" style={{ color: triggerIconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight">Risk Merkezi</p>
          <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--color-text-muted)' }}>
            {hasUrgent ? `${totalRisk} acil · ${totalItems} izlenen` : 'Aciliyet yok, izleme listesi'}
          </p>
        </div>
        <span
          className="inline-flex min-w-5.5 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {totalItems}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: 'var(--color-text-muted)' }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <div className="flex items-center justify-between gap-3 pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: triggerIconBg }}>
                <ShieldAlert className="h-5 w-5" style={{ color: triggerIconColor }} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[15px] font-bold truncate">Risk Merkezi</DialogTitle>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {hasUrgent ? `${totalRisk} acil madde bekliyor` : 'Aciliyet yok, izleme listesi'}
                </p>
              </div>
            </div>
            <Link
              href="/admin/reports"
              className="shrink-0 text-[11px] md:text-xs font-semibold"
              style={{ color: 'var(--color-primary)' }}
              onClick={() => setOpen(false)}
            >
              Rapor →
            </Link>
          </div>

          <div
            className="flex gap-1 overflow-x-auto px-1 py-2 -mx-1"
            style={{ borderBottom: '1px solid var(--color-border)' }}
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
                    background: isActive ? 'var(--color-bg)' : 'transparent',
                    color: isActive ? t.tone : 'var(--color-text-muted)',
                    border: isActive ? `1px solid ${t.tone}30` : '1px solid transparent',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span
                      className="inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: isActive ? t.tone : 'var(--color-border)',
                        color: isActive ? '#fff' : 'var(--color-text-secondary)',
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
      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'var(--color-bg)' }}>
        <Icon className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
      </div>
      <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
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
            className="rounded-xl border p-3"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>
                  {t.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{t.name}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{t.dept}</p>
              </div>
              <span
                className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
              >
                {t.daysOverdue} gün
              </span>
            </div>
            <p className="text-[12px] mb-2 truncate">{t.training}</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 rounded-lg text-xs"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
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
            <tr style={{ background: 'var(--color-bg)' }}>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Departman</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Tarih</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Gecikme</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => (
              <tr key={t.assignmentId} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: t.color }}>
                        {t.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5" style={{ color: 'var(--color-text-secondary)' }}>{t.dept}</td>
                <td className="px-4 py-3.5">{t.training}</td>
                <td className="px-4 py-3.5 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.dueDate}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                    {t.daysOverdue} gün gecikmiş
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-lg text-xs"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
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
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl p-3"
            style={{
              background: isCritical ? 'var(--color-error-bg)' : 'var(--color-warning-bg, #fffbeb)',
              border: `1px solid ${isCritical ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)'}30`,
            }}
          >
            <AlertTriangle
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: isCritical ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{alert.training}</p>
              {alert.regulatoryBody && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{alert.regulatoryBody}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs font-bold"
                  style={{ color: isCritical ? 'var(--color-error)' : 'var(--color-warning, #f59e0b)' }}
                >
                  {alert.status === 'overdue' ? 'Süre Doldu!' : `${alert.daysLeft} gün`}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>· %{alert.complianceRate} uyumlu</span>
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
        const tone = c.status === 'critical' ? 'var(--color-error)' : c.status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
        const toneBg = c.status === 'critical' ? 'var(--color-error-bg)' : c.status === 'warning' ? 'var(--color-warning-bg)' : 'var(--color-success-bg)';
        return (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-(--color-surface-hover)"
            style={{ border: '1px solid var(--color-border)' }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: toneBg }}>
              <CalendarClock className="h-5 w-5" style={{ color: tone }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{c.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{c.cert}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{c.expiryDate}</p>
              <p className="text-xs font-bold" style={{ color: tone }}>{c.daysLeft} gün</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
