'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft, Users, GraduationCap, TrendingUp,
  Edit, Ban, CheckCircle, Calendar, Activity, UserPlus, Eye,
  TriangleAlert, Shield, KeyRound,
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { StatCard } from '@/components/shared/stat-card';
import { useFetch, invalidateFetchCache } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { ResetPasswordModal } from '@/components/shared/reset-password-modal';
import { NewAdminModal } from './_components/new-admin-modal';
import { BulkResetStaffModal } from './_components/bulk-reset-staff-modal';

type AdminRow = { id: string; name: string; email: string; lastLogin: string };

interface OrganizationDetail {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
  plan: string;
  planStatus: string;
  expiresAt: string;
  staffCount: number;
  trainingCount: number;
  completionRate: number;
  // Personel (seat) limiti — GET route hesaplar. maxStaff: bu org'a özel override (null =
  // yok); effectiveStaffLimit: org.maxStaff ?? plan.maxStaff ?? sınırsız (null);
  // staffSeatUsage: aktif personel + bekleyen davet.
  maxStaff?: number | null;
  effectiveStaffLimit?: number | null;
  staffSeatUsage?: number;
  admins?: AdminRow[];
  recentActivity?: { action: string; detail: string; time: string; user: string }[];
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useFetch<OrganizationDetail>(`/api/super-admin/organizations/${id}`);
  const { toast } = useToast();
  const [viewingOrg, setViewingOrg] = useState(false);
  const [showNewAdminModal, setShowNewAdminModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [bulkResetOpen, setBulkResetOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmittingSuspend, setIsSubmittingSuspend] = useState(false);

  const closeSuspendModal = () => {
    setSuspendOpen(false);
    setSuspendReason('');
    setConfirmText('');
  };

  const handleSuspendConfirm = async () => {
    if (!data) return;
    const mode: 'suspend' | 'activate' = data.isSuspended ? 'activate' : 'suspend';
    if (mode === 'suspend' && confirmText.trim() !== data.name.trim()) return;

    setIsSubmittingSuspend(true);
    try {
      const res = await fetch(`/api/super-admin/organizations/${data.id}/suspend`, {
        method: mode === 'suspend' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: mode === 'suspend' ? JSON.stringify({ reason: suspendReason.trim() || null }) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (mode === 'suspend' ? 'Askıya alma başarısız' : 'Aktif etme başarısız'));
      }
      toast(mode === 'suspend' ? 'Organizasyon askıya alındı' : 'Organizasyon aktif edildi', 'success');
      closeSuspendModal();
      invalidateFetchCache(`/api/super-admin/organizations/${data.id}`);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setIsSubmittingSuspend(false);
    }
  };

  // Bu org'un yönetici panelini SALT-OKUNUR görüntüle. Kimlik değişmez
  // (impersonation YOK): kendi süper-admin oturumu korunur, imzalı klx-acting-org
  // cookie'si istekleri bu org'a scope'lar. Sonra /admin/dashboard'a gidilir.
  const handleViewOrg = async () => {
    setViewingOrg(true);
    try {
      const res = await fetch('/api/super-admin/act-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Görüntüleme başlatılamadı');
      // Full reload — middleware süper-admin'i /admin'e alır, banner acting durumu okur.
      window.location.href = '/admin/dashboard';
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
      setViewingOrg(false);
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>;
  }

  const organization = data;
  const admins = data.admins ?? [];
  const recentActivity = data.recentActivity ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="text-lg font-bold text-white" style={{ background: 'var(--color-primary)' }}>
              {organization.name?.slice(0, 2).toUpperCase() ?? ''}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate">
              {organization.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{organization.code}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{
                  background: organization.isSuspended ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                  color: organization.isSuspended ? 'var(--color-warning)' : 'var(--color-success)',
                }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: organization.isSuspended ? 'var(--color-warning)' : 'var(--color-success)' }} />
                {organization.isSuspended ? 'Askıda' : 'Aktif'}
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                {organization.plan}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            className="gap-2"
            onClick={handleViewOrg}
            disabled={viewingOrg}
            style={{ background: 'var(--color-primary)', color: 'white' }}
            title="Bu organizasyonun yönetici panelini salt-okunur görüntüle (kendi süper-admin oturumun korunur)"
          >
            <Eye className="h-4 w-4" /> {viewingOrg ? 'Açılıyor…' : 'Org Panelini Görüntüle'}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => router.push(`/super-admin/organizations/${organization.id}/edit`)}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <Edit className="h-4 w-4" /> Düzenle
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setBulkResetOpen(true)}
            disabled={organization.staffCount === 0}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-error)' }}
            title="Bu organizasyondaki tüm personelin (sadece staff) şifresini sıfırla ve PDF olarak indir"
          >
            <KeyRound className="h-4 w-4" /> Personel Şifrelerini Sıfırla
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setSuspendOpen(true)}
            style={{
              borderColor: 'var(--color-border)',
              color: organization.isSuspended ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            {organization.isSuspended ? (
              <><CheckCircle className="h-4 w-4" /> Aktif Et</>
            ) : (
              <><Ban className="h-4 w-4" /> Askıya Al</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Toplam Personel" value={organization.staffCount} icon={Users} accentColor="var(--color-primary)" />
        <StatCard title="Aktif Eğitim" value={organization.trainingCount} icon={GraduationCap} accentColor="var(--color-accent)" />
        <StatCard title="Tamamlanma Oranı" value={`${organization.completionRate}%`} icon={TrendingUp} accentColor="var(--color-success)" />
        <StatCard title="Abonelik Bitiş" value={organization.expiresAt} icon={Calendar} accentColor="var(--color-info)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Organization Info + Subscription */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold">İletişim Bilgileri</h3>
            <div className="space-y-3 text-sm">
              <div><span style={{ color: 'var(--color-text-muted)' }}>Adres:</span><p style={{ color: 'var(--color-text-primary)' }}>{organization.address}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Telefon:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{organization.phone}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>E-posta:</span><p style={{ color: 'var(--color-text-primary)' }}>{organization.email}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Kayıt Tarihi:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{organization.createdAt}</p></div>
            </div>
          </div>

          {/* Personel Koltukları (Seat Limit) */}
          {(() => {
            const limit = organization.effectiveStaffLimit;
            const used = organization.staffSeatUsage ?? 0;
            const hasLimit = typeof limit === 'number';
            const pct = hasLimit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const atLimit = hasLimit && used >= limit;
            const near = hasLimit && !atLimit && pct >= 90;
            const barColor = atLimit ? 'var(--color-error)' : near ? 'var(--color-warning)' : 'var(--color-primary)';
            return (
              <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Personel Limiti</h3>
                  <button
                    type="button"
                    onClick={() => router.push(`/super-admin/organizations/${organization.id}/edit`)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    <Edit className="h-3 w-3" /> Değiştir
                  </button>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {used}
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}> / {hasLimit ? limit : '∞'}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: atLimit ? 'var(--color-error-bg)' : near ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                      color: atLimit ? 'var(--color-error)' : near ? 'var(--color-warning)' : 'var(--color-success)',
                    }}>
                    {!hasLimit ? 'Sınırsız' : atLimit ? 'Limit dolu' : near ? 'Limite yakın' : 'Uygun'}
                  </span>
                </div>
                {hasLimit && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                )}
                <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  Aktif personel + bekleyen davet sayılır.
                  {typeof organization.maxStaff === 'number'
                    ? ' Bu kuruma özel sözleşme limiti uygulanıyor.'
                    : ' Org-özel limit yok — plan limiti/sınırsız geçerli.'}
                </p>
              </div>
            );
          })()}

          {/* Admin Users */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Admin Kullanıcılar</h3>
              <button
                type="button"
                onClick={() => setShowNewAdminModal(true)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                <UserPlus className="h-3 w-3" /> Yeni Admin
              </button>
            </div>
            <div className="space-y-3">
              {admins.length === 0 && (
                <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                  Henüz admin yok. &quot;Yeni Admin&quot; ile ekleyebilirsiniz.
                </p>
              )}
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--color-accent)' }}>
                      {admin.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{admin.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{admin.email}</p>
                  </div>
                  <button
                    title={`"${admin.name}" şifresini sıfırla`}
                    onClick={() => setResetTarget(admin)}
                    className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-opacity duration-150 hover:opacity-80"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
                  >
                    <KeyRound className="h-3 w-3" /> Şifre
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Activity className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-base font-bold">
                Son Aktiviteler
              </h3>
            </div>
            <div className="space-y-4">
              {recentActivity.map((item, idx) => (
                <div key={idx} className="flex gap-4 border-l-2 pl-4" style={{ borderColor: idx === 0 ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.action}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.detail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{item.user}</span>
                      <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>• {item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showNewAdminModal && (
        <NewAdminModal
          organizationId={organization.id}
          organizationName={organization.name}
          onClose={() => setShowNewAdminModal(false)}
          onSaved={() => {
            invalidateFetchCache(`/api/super-admin/organizations/${id}`);
            refetch();
          }}
        />
      )}

      <BulkResetStaffModal
        open={bulkResetOpen}
        onClose={() => setBulkResetOpen(false)}
        organizationId={organization.id}
        organizationName={organization.name}
        staffCount={organization.staffCount}
      />

      {resetTarget && (
        <ResetPasswordModal
          isOpen={!!resetTarget}
          onClose={() => setResetTarget(null)}
          userId={resetTarget.id}
          userName={resetTarget.name}
          userEmail={resetTarget.email}
          userRole="admin"
          caller="super_admin"
          endpoint={`/api/super-admin/users/${resetTarget.id}/reset-password`}
          onSuccess={() => {
            invalidateFetchCache(`/api/super-admin/organizations/${id}`);
            refetch();
          }}
        />
      )}

      {/* Suspend / Activate Confirmation Modal */}
      <Dialog open={suspendOpen} onOpenChange={(open) => { if (!open) closeSuspendModal(); }}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: organization.isSuspended ? 'var(--color-success-bg)' : 'var(--color-error-bg)' }}
              >
                {organization.isSuspended
                  ? <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                  : <TriangleAlert className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                }
              </div>
              <DialogTitle>
                {organization.isSuspended ? 'Organizasyonu Aktif Et' : 'Organizasyonu Askıya Al'}
              </DialogTitle>
            </div>
            <DialogDescription>
              {organization.isSuspended
                ? `"${organization.name}" aktif edilecek ve kullanıcılar sisteme tekrar erişebilecek.`
                : `"${organization.name}" askıya alındığında bu organizasyon adminleri ve personeli sisteme erişemez.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!organization.isSuspended && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold">Askıya Alma Nedeni</Label>
                  <textarea
                    rows={3}
                    placeholder="Ör: Ödeme gecikti, abonelik sona erdi..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold">
                    Onaylamak için organizasyon adını yazın:{' '}
                    <span className="font-mono" style={{ color: 'var(--color-error)' }}>{organization.name.trim()}</span>
                  </Label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={organization.name.trim()}
                    className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                    style={{
                      background: 'var(--color-bg)',
                      borderColor: confirmText && confirmText.trim() !== organization.name.trim() ? 'var(--color-error)' : 'var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  {confirmText && confirmText.trim() !== organization.name.trim() && (
                    <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>Organizasyon adı eşleşmiyor</p>
                  )}
                </div>
              </>
            )}

            {organization.isSuspended && (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)20' }}>
                <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                <p className="text-[12px]" style={{ color: 'var(--color-success)' }}>
                  Bu organizasyon {organization.staffCount} kullanıcıya sahip. Aktif etme sonrası tümü sisteme erişebilir.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={closeSuspendModal}
              className="rounded-xl border px-4 py-2 text-[13px] font-semibold"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              İptal
            </button>
            <button
              onClick={handleSuspendConfirm}
              disabled={isSubmittingSuspend || (!organization.isSuspended && confirmText.trim() !== organization.name.trim())}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
              style={{ background: organization.isSuspended ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              {isSubmittingSuspend ? 'İşleniyor...' : organization.isSuspended ? 'Aktif Et' : 'Askıya Al'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
