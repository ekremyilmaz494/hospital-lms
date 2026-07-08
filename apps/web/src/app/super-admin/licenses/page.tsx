'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  KeyRound, Plus, Eye, CheckCircle, Ban, Radio, X,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface LicenseHeartbeatSummary {
  receivedAt: string;
  orgCount: number;
  staffCount: number;
  appVersion: string | null;
}

interface LicenseRow {
  id: string;
  customerName: string;
  contactEmail: string | null;
  licenseType: string; // 'standard' | 'trial'
  maxOrganizations: number | null;
  maxStaff: number | null;
  graceDays: number;
  validUntil: string | null; // null = süresiz (perpetual)
  status: string; // 'active' | 'revoked'
  revokedAt: string | null;
  createdAt: string;
  activationCount: number;
  lastHeartbeat: LicenseHeartbeatSummary | null;
}

interface LicensesResponse {
  licenses: LicenseRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Bu süreden eski heartbeat = kurulumdan haber alınamıyor (uyarı rengi) */
const STALE_HEARTBEAT_DAYS = 7;

const typeMap: Record<string, { label: string; bg: string; text: string }> = {
  standard: { label: 'Standart', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  trial: { label: 'Deneme', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
};

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktif', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  revoked: { label: 'İptal', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function LicensesPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<LicensesResponse>('/api/super-admin/licenses');

  // Kayıt dialog state
  const [registerOpen, setRegisterOpen] = useState(false);
  const [licenseJwt, setLicenseJwt] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const licenses = useMemo(() => data?.licenses ?? [], [data]);

  // Stat sayaçları client-side türetilir (4 ayrı tarama → memoize)
  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: licenses.length,
      active: licenses.filter((l) => l.status === 'active').length,
      revoked: licenses.filter((l) => l.status === 'revoked').length,
      recentHeartbeat: licenses.filter(
        (l) => l.lastHeartbeat && now - new Date(l.lastHeartbeat.receivedAt).getTime() <= DAY_MS,
      ).length,
    };
  }, [licenses]);

  const openRegister = () => {
    setLicenseJwt('');
    setContactEmail('');
    setNotes('');
    setSubmitError(null);
    setRegisterOpen(true);
  };

  const closeRegister = () => {
    if (isSubmitting) return;
    setRegisterOpen(false);
  };

  const handleRegister = async () => {
    if (!licenseJwt.trim()) {
      setSubmitError('Lisans JWT alanı zorunludur');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/super-admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseJwt: licenseJwt.trim(),
          contactEmail: contactEmail.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Lisans kaydedilemedi');
      toast(res.status === 201 ? 'Lisans kaydedildi' : 'Lisans güncellendi', 'success');
      setRegisterOpen(false);
      invalidateFetchCache('/api/super-admin/licenses');
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader
          title="Lisanslar"
          subtitle="On-prem kurulum lisanslarını kaydedin, izleyin ve yönetin"
          action={{ label: 'Lisans Kaydet', icon: Plus, onClick: openRegister }}
        />
      </BlurFade>

      {/* Stat Cards */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Toplam Lisans', value: stats.total, icon: KeyRound, color: 'var(--color-primary)' },
            { label: 'Aktif', value: stats.active, icon: CheckCircle, color: 'var(--color-success)' },
            { label: 'İptal Edilmiş', value: stats.revoked, icon: Ban, color: 'var(--color-error)' },
            { label: 'Son 24s Heartbeat', value: stats.recentHeartbeat, icon: Radio, color: 'var(--color-info)' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border p-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.color}12` }}>
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                <p className="text-xl font-bold font-mono">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* License Table */}
      <BlurFade delay={0.05}>
        {licenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <KeyRound className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[15px] font-bold mb-1">Henüz lisans kaydı yok</p>
            <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
              CLI ile imzalanmış lisans JWT&apos;sini yapıştırarak ilk lisansı kaydedin
            </p>
            <button
              onClick={openRegister}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              <Plus className="h-4 w-4" /> İlk Lisansı Kaydet
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Müşteri</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Bitiş</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Limitler</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Aktivasyon</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Heartbeat</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => {
                    const type = typeMap[license.licenseType] ?? typeMap.standard;
                    const status = statusMap[license.status] ?? statusMap.active;

                    // Bitiş hücresi: null = süresiz; geçmişse kırmızı + kaç gün önce dolduğu
                    let validityLabel = 'Süresiz';
                    let validityDetail: string | null = null;
                    let validityColor = 'var(--color-text-secondary)';
                    if (license.validUntil) {
                      const remainingDays = Math.ceil((new Date(license.validUntil).getTime() - Date.now()) / DAY_MS);
                      validityLabel = formatDate(license.validUntil);
                      if (remainingDays < 0) {
                        validityDetail = `${Math.abs(remainingDays)} gün önce doldu`;
                        validityColor = 'var(--color-error)';
                      } else {
                        validityDetail = `${remainingDays} gün kaldı`;
                      }
                    }

                    // Heartbeat hücresi: 7 günden eski = uyarı rengi
                    const hb = license.lastHeartbeat;
                    const hbStale = hb ? Date.now() - new Date(hb.receivedAt).getTime() > STALE_HEARTBEAT_DAYS * DAY_MS : false;

                    return (
                      <tr key={license.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-3 pr-4">
                          <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{license.customerName}</p>
                          {license.contactEmail && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{license.contactEmail}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: type.bg, color: type.text }}>
                            {type.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: validityColor }}>{validityLabel}</p>
                          {validityDetail && (
                            <p className="text-[11px]" style={{ color: validityColor === 'var(--color-error)' ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                              {validityDetail}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                          <p>{license.maxOrganizations === null ? 'Sınırsız org' : `${license.maxOrganizations} org`}</p>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            {license.maxStaff === null ? 'Sınırsız personel' : `${license.maxStaff} personel`}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {license.activationCount}
                        </td>
                        <td className="py-3 pr-4">
                          {hb ? (
                            <>
                              <p className="text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: hbStale ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                                {formatDateTime(hb.receivedAt)}
                              </p>
                              <p className="text-[11px]" style={{ color: hbStale ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                                {hb.orgCount} org / {hb.staffCount} personel
                              </p>
                            </>
                          ) : (
                            <span className="text-[13px] italic" style={{ color: 'var(--color-text-muted)' }}>Hiç</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: status.bg, color: status.text }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.text }} />
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/super-admin/licenses/${license.id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-opacity duration-150 hover:opacity-80"
                            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                          >
                            <Eye className="h-3 w-3" /> Detay
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </BlurFade>

      {/* Lisans Kaydet Dialog */}
      <Dialog open={registerOpen} onOpenChange={(open) => { if (!open) closeRegister(); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                <KeyRound className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <DialogTitle>Lisans Kaydet</DialogTitle>
            </div>
            <DialogDescription>
              Offline CLI ile imzalanmış lisans JWT&apos;sini yapıştırın. Aynı lisansın yeni JWT&apos;si (örn. süre uzatma) mevcut kaydı günceller.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">Lisans JWT *</Label>
              <textarea
                rows={5}
                placeholder="eyJhbGciOi..."
                value={licenseJwt}
                onChange={(e) => setLicenseJwt(e.target.value)}
                className="w-full resize-none rounded-xl border px-3 py-2.5 text-[12px] outline-none"
                style={{
                  background: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">İletişim E-postası</Label>
              <input
                type="email"
                placeholder="ornek@hastane.com (opsiyonel)"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">Notlar</Label>
              <textarea
                rows={2}
                placeholder="İç not (opsiyonel)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: 'var(--color-error-bg)' }}>
                <X className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
                <p className="text-[12px]" style={{ color: 'var(--color-error)' }}>{submitError}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={closeRegister}
              className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors duration-150"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Vazgeç
            </button>
            <button
              onClick={handleRegister}
              disabled={isSubmitting || !licenseJwt.trim()}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
