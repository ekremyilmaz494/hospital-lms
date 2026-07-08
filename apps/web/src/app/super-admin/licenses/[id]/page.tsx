'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, KeyRound, Ban, CheckCircle, TriangleAlert, Server, Radio, Save,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/shared/page-loading';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

interface LicenseActivationRow {
  id: string;
  instanceId: string;
  appVersion: string | null;
  hostname: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface LicenseHeartbeatRow {
  id: string;
  instanceId: string;
  orgCount: number;
  staffCount: number;
  appVersion: string | null;
  receivedAt: string;
}

interface LicenseDetail {
  id: string;
  customerName: string;
  contactEmail: string | null;
  schemaVersion: number;
  licenseType: string; // 'standard' | 'trial'
  maxOrganizations: number | null;
  maxStaff: number | null;
  graceDays: number;
  validUntil: string | null; // null = süresiz
  status: string; // 'active' | 'revoked'
  revokedAt: string | null;
  revokeReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activations: LicenseActivationRow[];
  heartbeats: LicenseHeartbeatRow[]; // son 30
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Bu pencere içinde görülen instance "aktif" sayılır (paylaşım şüphesi tespiti) */
const ACTIVE_INSTANCE_DAYS = 7;

const typeMap: Record<string, { label: string; bg: string; text: string }> = {
  standard: { label: 'Standart', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  trial: { label: 'Deneme', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function LicenseDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<LicenseDetail>(`/api/super-admin/licenses/${id}`);

  // İptal / iptal kaldırma dialog state
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [isSubmittingRevoke, setIsSubmittingRevoke] = useState(false);

  // İletişim / not düzenleme state — data yüklenince senkronize edilir
  const [metaEmail, setMetaEmail] = useState('');
  const [metaNotes, setMetaNotes] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  useEffect(() => {
    if (data) {
      setMetaEmail(data.contactEmail ?? '');
      setMetaNotes(data.notes ?? '');
    }
  }, [data]);

  // Paylaşım şüphesi: son 7 günde görülmüş 1'den fazla instance
  const activeInstanceCount = useMemo(() => {
    if (!data) return 0;
    const threshold = Date.now() - ACTIVE_INSTANCE_DAYS * DAY_MS;
    return data.activations.filter((a) => new Date(a.lastSeenAt).getTime() >= threshold).length;
  }, [data]);

  const invalidateAndRefetch = () => {
    invalidateFetchCache('/api/super-admin/licenses');
    refetch();
  };

  const handleSaveMeta = async () => {
    if (!data) return;
    setIsSavingMeta(true);
    try {
      const res = await fetch(`/api/super-admin/licenses/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail: metaEmail.trim() || null,
          notes: metaNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Güncelleme başarısız');
      }
      toast('Lisans bilgileri güncellendi', 'success');
      invalidateAndRefetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const openRevokeModal = () => {
    setRevokeReason('');
    setRevokeOpen(true);
  };

  const closeRevokeModal = () => {
    if (isSubmittingRevoke) return;
    setRevokeOpen(false);
    setRevokeReason('');
  };

  const handleRevokeConfirm = async () => {
    if (!data) return;
    const mode: 'revoke' | 'unrevoke' = data.status === 'revoked' ? 'unrevoke' : 'revoke';
    setIsSubmittingRevoke(true);
    try {
      const res = await fetch(`/api/super-admin/licenses/${data.id}/revoke`, {
        method: mode === 'revoke' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: mode === 'revoke' ? JSON.stringify({ reason: revokeReason.trim() || undefined }) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (mode === 'revoke' ? 'İptal başarısız' : 'İptal kaldırma başarısız'));
      }
      toast(mode === 'revoke' ? 'Lisans iptal edildi' : 'Lisans iptali kaldırıldı', 'success');
      closeRevokeModal();
      invalidateAndRefetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setIsSubmittingRevoke(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;
  if (!data) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div></div>;

  const isRevoked = data.status === 'revoked';
  const type = typeMap[data.licenseType] ?? typeMap.standard;

  // Geçerlilik özeti
  let validityLabel = 'Süresiz';
  let validityDetail: string | null = null;
  let validityColor = 'var(--color-text-primary)';
  if (data.validUntil) {
    const remainingDays = Math.ceil((new Date(data.validUntil).getTime() - Date.now()) / DAY_MS);
    validityLabel = formatDate(data.validUntil);
    if (remainingDays < 0) {
      validityDetail = `${Math.abs(remainingDays)} gün önce doldu`;
      validityColor = 'var(--color-error)';
    } else {
      validityDetail = `${remainingDays} gün kaldı`;
    }
  }

  const claimRows: { label: string; value: string; mono?: boolean; color?: string }[] = [
    { label: 'Müşteri', value: data.customerName },
    { label: 'Tür', value: type.label },
    { label: 'Maks. Organizasyon', value: data.maxOrganizations === null ? 'Sınırsız' : String(data.maxOrganizations), mono: true },
    { label: 'Maks. Personel', value: data.maxStaff === null ? 'Sınırsız' : String(data.maxStaff), mono: true },
    { label: 'Tolerans Süresi', value: `${data.graceDays} gün`, mono: true },
    { label: 'Geçerlilik', value: validityDetail ? `${validityLabel} (${validityDetail})` : validityLabel, mono: true, color: validityColor },
    { label: 'Şema Versiyonu', value: `v${data.schemaVersion}`, mono: true },
    { label: 'Kayıt Tarihi', value: formatDateTime(data.createdAt), mono: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--color-primary-light)' }}>
            <KeyRound className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate">{data.customerName}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }} title="Lisans ID (jti)">
                {data.id}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{
                  background: isRevoked ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                  color: isRevoked ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: isRevoked ? 'var(--color-error)' : 'var(--color-success)' }} />
                {isRevoked ? 'İptal Edildi' : 'Aktif'}
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: type.bg, color: type.text }}>
                {type.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={openRevokeModal}
            style={{
              borderColor: 'var(--color-border)',
              color: isRevoked ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            {isRevoked ? (
              <><CheckCircle className="h-4 w-4" /> İptali Kaldır</>
            ) : (
              <><Ban className="h-4 w-4" /> İptal Et</>
            )}
          </Button>
        </div>
      </div>

      {/* Paylaşım şüphesi banner'ı — son 7 günde 1'den fazla instance görülmüş */}
      {activeInstanceCount > 1 && (
        <div
          className="flex items-start gap-3 rounded-2xl border px-5 py-4"
          style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)' }}
        >
          <TriangleAlert className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-error)' }}>Lisans paylaşım şüphesi</p>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-error)' }}>
              Bu lisans son {ACTIVE_INSTANCE_DAYS} günde {activeInstanceCount} farklı kurulumdan sinyal gönderdi.
              Lisans birden fazla sunucuya kopyalanmış olabilir — aktivasyon listesini inceleyin.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sol kolon: lisans özeti + iletişim/not düzenleme */}
        <div className="lg:col-span-1 space-y-4">
          {/* Lisans Özeti */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold">Lisans Bilgileri</h3>
            <div className="space-y-3 text-sm">
              {claimRows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
                  <span
                    className="text-[13px] font-medium text-right"
                    style={{
                      color: row.color ?? 'var(--color-text-primary)',
                      ...(row.mono ? { fontFamily: 'var(--font-mono)' } : {}),
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {isRevoked && (
              <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'var(--color-error-bg)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--color-error)' }}>
                  İptal tarihi: {data.revokedAt ? formatDateTime(data.revokedAt) : '—'}
                </p>
                {data.revokeReason && (
                  <p className="text-[12px] mt-1" style={{ color: 'var(--color-error)' }}>
                    Neden: {data.revokeReason}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* İletişim & Not */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold">İletişim & Notlar</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">İletişim E-postası</Label>
                <input
                  type="email"
                  placeholder="ornek@hastane.com"
                  value={metaEmail}
                  onChange={(e) => setMetaEmail(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Notlar</Label>
                <textarea
                  rows={4}
                  placeholder="İç not..."
                  value={metaNotes}
                  onChange={(e) => setMetaNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveMeta}
                  disabled={isSavingMeta}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingMeta ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ kolon: aktivasyonlar + heartbeat'ler */}
        <div className="lg:col-span-2 space-y-4">
          {/* Aktivasyonlar */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Server className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-base font-bold">Aktivasyonlar</h3>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>({data.activations.length})</span>
            </div>
            {data.activations.length === 0 ? (
              <p className="text-sm italic py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Henüz aktivasyon yok — kurulum ilk açılışta buraya kaydolur
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Instance</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sunucu Adı</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sürüm</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İlk Görülme</th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Görülme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activations.map((activation) => (
                      <tr key={activation.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-3 pr-4">
                          <span className="text-[12px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }} title={activation.instanceId}>
                            {activation.instanceId.slice(0, 8)}…
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                          {activation.hostname ?? '—'}
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {activation.appVersion ?? '—'}
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {formatDateTime(activation.firstSeenAt)}
                        </td>
                        <td className="py-3 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {formatDateTime(activation.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Son Heartbeat'ler */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
                <Radio className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
              </div>
              <h3 className="text-base font-bold">Son Heartbeat&apos;ler</h3>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>(son {data.heartbeats.length})</span>
            </div>
            {data.heartbeats.length === 0 ? (
              <p className="text-sm italic py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                Henüz heartbeat alınmadı
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Alınma Zamanı</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Instance</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Organizasyon</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sürüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.heartbeats.map((heartbeat) => (
                      <tr key={heartbeat.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                          {formatDateTime(heartbeat.receivedAt)}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-[12px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }} title={heartbeat.instanceId}>
                            {heartbeat.instanceId.slice(0, 8)}…
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {heartbeat.orgCount}
                        </td>
                        <td className="py-3 pr-4 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {heartbeat.staffCount}
                        </td>
                        <td className="py-3 text-[13px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                          {heartbeat.appVersion ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* İptal / İptal Kaldırma Onay Dialog'u */}
      <Dialog open={revokeOpen} onOpenChange={(open) => { if (!open) closeRevokeModal(); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: isRevoked ? 'var(--color-success-bg)' : 'var(--color-error-bg)' }}
              >
                {isRevoked
                  ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                  : <TriangleAlert className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                }
              </div>
              <DialogTitle>{isRevoked ? 'Lisans İptalini Kaldır' : 'Lisansı İptal Et'}</DialogTitle>
            </div>
            <DialogDescription>
              {isRevoked
                ? `"${data.customerName}" lisansının iptali kaldırılacak ve kurulum yeniden doğrulanabilecek.`
                : `"${data.customerName}" lisansı iptal edildiğinde on-prem kurulum kilitlenir.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!isRevoked && (
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">İptal Nedeni</Label>
                <textarea
                  rows={3}
                  placeholder="Ör: Sözleşme sona erdi, ödeme yapılmadı... (opsiyonel)"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>
            )}

            <div
              className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{ background: isRevoked ? 'var(--color-success-bg)' : 'var(--color-warning-bg)' }}
            >
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" style={{ color: isRevoked ? 'var(--color-success)' : 'var(--color-warning)' }} />
              <p className="text-[12px]" style={{ color: isRevoked ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {isRevoked
                  ? 'İptal kaldırma, kuruluma bir sonraki heartbeat\'te (~6 saat içinde) yansır.'
                  : 'İptal anında değil, bir sonraki heartbeat\'te (~6 saat içinde) kuruluma yansır.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={closeRevokeModal}
              className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors duration-150"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Vazgeç
            </button>
            <button
              onClick={handleRevokeConfirm}
              disabled={isSubmittingRevoke}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
              style={{ background: isRevoked ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              {isSubmittingRevoke ? 'İşleniyor...' : isRevoked ? 'İptali Kaldır' : 'İptal Et'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
