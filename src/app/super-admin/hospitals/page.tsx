'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, Plus, MoreHorizontal, Eye, Edit, Ban, CheckCircle, Users,
  GraduationCap, AlertTriangle, Search, Shield, TriangleAlert,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface HospitalRaw {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
  subscription?: {
    status: string;
    plan: { name: string; slug: string };
    expiresAt?: string;
  };
  _count: { users: number; trainings: number };
}

interface HospitalsResponse {
  hospitals: HospitalRaw[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const planColors: Record<string, { bg: string; text: string; accent: string }> = {
  'Başlangıç': { bg: 'var(--color-info-bg)', text: 'var(--color-info)', accent: 'var(--color-info)' },
  'Profesyonel': { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', accent: 'var(--color-accent)' },
  'Kurumsal': { bg: 'var(--color-success-bg)', text: 'var(--color-success)', accent: 'var(--color-primary)' },
};

type StatusFilter = 'all' | 'active' | 'suspended';

interface SuspendTarget {
  hospital: HospitalRaw;
  mode: 'suspend' | 'activate';
}

export default function HospitalsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // G3.1 — Soft suspend modal state
  const [suspendTarget, setSuspendTarget] = useState<SuspendTarget | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, error, refetch } = useFetch<HospitalsResponse>('/api/super-admin/hospitals?limit=100');

  const allHospitals = data?.hospitals ?? [];

  // Client-side filtering
  const filtered = allHospitals.filter(h => {
    const matchesSearch = !search ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && h.isActive && !h.isSuspended) ||
      (statusFilter === 'suspended' && h.isSuspended);
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalCount = allHospitals.length;
  const activeCount = allHospitals.filter(h => h.isActive && !h.isSuspended).length;
  const suspendedCount = allHospitals.filter(h => h.isSuspended).length;
  const totalStaff = allHospitals.reduce((sum, h) => sum + h._count.users, 0);

  const getStatus = (h: HospitalRaw) => {
    if (h.isSuspended) return { label: 'Askıda', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' };
    if (!h.isActive) return { label: 'Pasif', color: 'var(--color-text-muted)', bg: 'var(--color-bg)' };
    if (h.subscription?.status === 'trial') return { label: 'Deneme', color: 'var(--color-info)', bg: 'var(--color-info-bg)' };
    if (h.subscription?.status === 'expired') return { label: 'Süresi Doldu', color: 'var(--color-error)', bg: 'var(--color-error-bg)' };
    return { label: 'Aktif', color: 'var(--color-success)', bg: 'var(--color-success-bg)' };
  };

  // G3.1 — Open the modal (does NOT call fetch directly)
  const openSuspendModal = (hospital: HospitalRaw) => {
    setSuspendTarget({ hospital, mode: hospital.isSuspended ? 'activate' : 'suspend' });
    setSuspendReason('');
    setConfirmText('');
  };

  const closeSuspendModal = () => {
    setSuspendTarget(null);
    setSuspendReason('');
    setConfirmText('');
  };

  // G3.1 — Called after user has confirmed in the modal
  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    const { hospital, mode } = suspendTarget;

    // Type-to-confirm guard for suspend
    if (mode === 'suspend' && confirmText.trim() !== hospital.name) return;

    setIsSubmitting(true);
    try {
      if (mode === 'suspend') {
        const res = await fetch(`/api/super-admin/hospitals/${hospital.id}/suspend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: suspendReason.trim() || null }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Askıya alma başarısız');
        }
        toast('Hastane askıya alındı', 'success');
      } else {
        const res = await fetch(`/api/super-admin/hospitals/${hospital.id}/suspend`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Aktif etme başarısız');
        }
        toast('Hastane aktif edildi', 'success');
      }
      closeSuspendModal();
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: totalCount },
    { key: 'active', label: 'Aktif', count: activeCount },
    { key: 'suspended', label: 'Askıda', count: suspendedCount },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader
          title="Hastane Yönetimi"
          subtitle="Tüm hastaneleri görüntüle ve yönet"
          action={{ label: 'Yeni Hastane', icon: Plus, href: '/super-admin/hospitals/new' }}
        />
      </BlurFade>

      {/* Stat Cards */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Toplam Hastane', value: totalCount, icon: Building2, color: 'var(--color-primary)' },
            { label: 'Aktif', value: activeCount, icon: CheckCircle, color: 'var(--color-success)' },
            { label: 'Askıda', value: suspendedCount, icon: AlertTriangle, color: 'var(--color-warning)' },
            { label: 'Toplam Personel', value: totalStaff, icon: Users, color: 'var(--color-info)' },
          ].map(s => (
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

      {/* Filter Bar + Search */}
      <BlurFade delay={0.05}>
        <div className="flex items-center justify-between gap-4">
          {/* Status Filters */}
          <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {statusFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150"
                style={{
                  background: statusFilter === f.key ? 'var(--color-primary)' : 'transparent',
                  color: statusFilter === f.key ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                {f.label}
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{
                    background: statusFilter === f.key ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
                    color: statusFilter === f.key ? 'white' : 'var(--color-text-muted)',
                  }}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="Hastane ara (isim veya kod)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
            />
          </div>
        </div>
      </BlurFade>

      {/* Hospital Cards */}
      <BlurFade delay={0.07}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <Building2 className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[15px] font-bold mb-1">Hastane bulunamadı</p>
            <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {search ? 'Arama kriterlerinizi değiştirmeyi deneyin' : 'Henüz hastane kaydı oluşturulmamış'}
            </p>
            {!search && (
              <Link href="/super-admin/hospitals/new">
                <Button className="gap-2 rounded-xl text-white font-semibold" style={{ background: 'var(--color-primary)' }}>
                  <Plus className="h-4 w-4" /> İlk Hastaneyi Ekle
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((hospital, idx) => {
              const status = getStatus(hospital);
              const plan = hospital.subscription?.plan?.name ?? 'Yok';
              const pc = planColors[plan] ?? { bg: 'var(--color-info-bg)', text: 'var(--color-info)', accent: 'var(--color-info)' };
              const createdDate = new Date(hospital.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

              return (
                <div
                  key={hospital.id}
                  className="group relative rounded-2xl border overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: hospital.isSuspended ? 'var(--color-warning)' : 'var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: hospital.isSuspended ? 0.85 : 1,
                  }}
                >
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: `linear-gradient(180deg, ${pc.accent}, ${pc.accent}60)` }} />

                  <div className="flex items-center gap-5 p-5 pl-7">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <AvatarFallback className="text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${pc.accent}, ${pc.accent}cc)` }}>
                        {hospital.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-bold truncate">{hospital.name}</h3>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          {hospital.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {hospital._count.users} personel
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5" /> {hospital._count.trainings} eğitim
                        </span>
                        <span className="font-mono">{createdDate}</span>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Plan badge */}
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: pc.bg, color: pc.text }}>
                        {plan}
                      </span>

                      {/* Status badge */}
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: status.bg, color: status.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                        {status.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--color-text-muted)' }}>
                        <MoreHorizontal className="h-5 w-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/super-admin/hospitals/${hospital.id}`)}>
                          <Eye className="h-4 w-4" /> Detay Görüntüle
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/super-admin/hospitals/${hospital.id}/edit`)}>
                          <Edit className="h-4 w-4" /> Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          style={{ color: hospital.isSuspended ? 'var(--color-success)' : 'var(--color-error)' }}
                          onClick={() => openSuspendModal(hospital)}
                        >
                          {hospital.isSuspended ? (
                            <><CheckCircle className="h-4 w-4" /> Aktif Et</>
                          ) : (
                            <><Ban className="h-4 w-4" /> Askıya Al</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BlurFade>

      {/* Footer info */}
      {filtered.length > 0 && (
        <div className="text-center">
          <p className="text-[12px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} / {totalCount} hastane gösteriliyor
          </p>
        </div>
      )}

      {/* G3.1 — Soft Suspend / Activate Confirmation Modal */}
      <Dialog open={suspendTarget !== null} onOpenChange={(open) => { if (!open) closeSuspendModal(); }}>
        <DialogContent showCloseButton>
          {suspendTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: suspendTarget.mode === 'suspend' ? 'var(--color-error-bg)' : 'var(--color-success-bg)' }}
                  >
                    {suspendTarget.mode === 'suspend'
                      ? <TriangleAlert className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                      : <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                    }
                  </div>
                  <DialogTitle>
                    {suspendTarget.mode === 'suspend' ? 'Hastaneyi Askıya Al' : 'Hastaneyi Aktif Et'}
                  </DialogTitle>
                </div>
                <DialogDescription>
                  {suspendTarget.mode === 'suspend'
                    ? `"${suspendTarget.hospital.name}" askıya alındığında bu hastane adminleri ve personeli sisteme erişemez.`
                    : `"${suspendTarget.hospital.name}" aktif edilecek ve kullanıcılar sisteme tekrar erişebilecek.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {suspendTarget.mode === 'suspend' && (
                  <>
                    {/* Reason field */}
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold">Askıya Alma Nedeni</Label>
                      <textarea
                        rows={3}
                        placeholder="Ör: Ödeme gecikti, abonelik sona erdi..."
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                        style={{
                          background: 'var(--color-bg)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>

                    {/* Type-to-confirm */}
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold">
                        Onaylamak için hastane adını yazın:{' '}
                        <span className="font-mono" style={{ color: 'var(--color-error)' }}>
                          {suspendTarget.hospital.name}
                        </span>
                      </Label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={suspendTarget.hospital.name}
                        className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                        style={{
                          background: 'var(--color-bg)',
                          borderColor: confirmText && confirmText !== suspendTarget.hospital.name
                            ? 'var(--color-error)'
                            : 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                      {confirmText && confirmText !== suspendTarget.hospital.name && (
                        <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>
                          Hastane adı eşleşmiyor
                        </p>
                      )}
                    </div>
                  </>
                )}

                {suspendTarget.mode === 'activate' && (
                  <div
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                    style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)20' }}
                  >
                    <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                    <p className="text-[12px]" style={{ color: 'var(--color-success)' }}>
                      Bu hastane {suspendTarget.hospital._count.users} kullanıcıya sahip. Aktif etme sonrası tümü sisteme erişebilir.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeSuspendModal}
                  className="rounded-xl border px-4 py-2 text-[13px] font-semibold transition-colors duration-150"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  İptal
                </button>
                <button
                  onClick={handleSuspendConfirm}
                  disabled={
                    isSubmitting ||
                    (suspendTarget.mode === 'suspend' && confirmText.trim() !== suspendTarget.hospital.name)
                  }
                  className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
                  style={{
                    background: suspendTarget.mode === 'suspend' ? 'var(--color-error)' : 'var(--color-success)',
                  }}
                >
                  {isSubmitting
                    ? 'İşleniyor...'
                    : suspendTarget.mode === 'suspend'
                      ? 'Askıya Al'
                      : 'Aktif Et'
                  }
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
