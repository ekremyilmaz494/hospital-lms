'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Boxes, ArrowLeft, Building2, User, Plus, X, Crown, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface GroupDetail {
  id: string;
  name: string;
  code: string;
  maxOrganizations: number | null;
  brandColor: string;
  isActive: boolean;
  createdAt: string;
  ownerUser: { id: string; firstName: string; lastName: string; email: string; isActive: boolean } | null;
  organizations: { id: string; name: string; code: string; isActive: boolean; isSuspended: boolean; _count: { users: number } }[];
  _count: { organizations: number };
}

interface OrgRaw {
  id: string;
  name: string;
  code: string;
  groupId: string | null;
  isDemo: boolean;
}
interface OrgsResponse { organizations: OrgRaw[] }

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { toast } = useToast();
  const { data: group, isLoading, error, refetch } = useFetch<GroupDetail>(`/api/super-admin/groups/${groupId}`);
  const { data: orgsData } = useFetch<OrgsResponse>('/api/super-admin/organizations?limit=500');

  const [attachId, setAttachId] = useState('');
  const [limitEdit, setLimitEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableOrgs = (orgsData?.organizations ?? []).filter((o) => !o.groupId && !o.isDemo);

  if (isLoading) return <PageLoading />;
  if (error || !group)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error ?? 'Grup bulunamadı'}</div>
      </div>
    );

  const atLimit = group.maxOrganizations != null && group._count.organizations >= group.maxOrganizations;

  const attach = async () => {
    if (!attachId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/groups/${groupId}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: attachId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Hastane eklenemedi');
      setAttachId('');
      toast('Hastane gruba eklendi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata', 'error');
    } finally {
      setBusy(false);
    }
  };

  const detach = async (orgId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/groups/${groupId}/organizations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Hastane çıkarılamadı');
      toast('Hastane gruptan çıkarıldı', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveLimit = async () => {
    if (limitEdit === null || busy) return;
    setBusy(true);
    try {
      const value = limitEdit.trim() === '' ? null : Number(limitEdit);
      const res = await fetch(`/api/super-admin/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxOrganizations: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Kaydedilemedi');
      setLimitEdit(null);
      toast('Hastane limiti güncellendi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/super-admin/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !group.isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Güncellenemedi');
      }
      toast(group.isActive ? 'Grup pasifleştirildi' : 'Grup aktifleştirildi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <Link href="/super-admin/groups" className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Gruplar
        </Link>
        <PageHeader
          title={group.name}
          subtitle={`Grup kodu: ${group.code}`}
          action={{ label: group.isActive ? 'Pasifleştir' : 'Aktifleştir', onClick: toggleActive }}
        />
      </BlurFade>

      {/* Owner + limit */}
      <BlurFade delay={0.03}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
              <span className="text-[13px] font-bold">Grup Yöneticisi</span>
            </div>
            {group.ownerUser ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-bg)' }}>
                  <User className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold truncate">{group.ownerUser.firstName} {group.ownerUser.lastName}</p>
                  <p className="text-[12px] font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>{group.ownerUser.email}</p>
                </div>
                {!group.ownerUser.isActive && (
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>Pasif</span>
                )}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Yönetici atanmamış</p>
            )}
          </div>

          <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
              <span className="text-[13px] font-bold">Hastane Limiti (Sözleşme)</span>
            </div>
            {limitEdit === null ? (
              <div className="flex items-center gap-3">
                <p className="text-xl font-bold font-mono">
                  {group._count.organizations}
                  <span className="text-[13px] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                    {' '}/ {group.maxOrganizations ?? '∞'}
                  </span>
                </p>
                <Button variant="outline" size="sm" className="ml-auto rounded-lg" onClick={() => setLimitEdit(group.maxOrganizations?.toString() ?? '')}>
                  Düzenle
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={limitEdit} onChange={(e) => setLimitEdit(e.target.value)} placeholder="Boş → sınırsız" className="h-9 max-w-[140px]" />
                <Button size="sm" onClick={saveLimit} disabled={busy} className="gap-1 rounded-lg text-white" style={{ background: 'var(--color-primary)' }}>
                  <Save className="h-4 w-4" /> Kaydet
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLimitEdit(null)} className="rounded-lg">İptal</Button>
              </div>
            )}
          </div>
        </div>
      </BlurFade>

      {/* Attach hospital */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <span className="text-[13px] font-bold">Gruba Hastane Ekle</span>
          </div>
          {atLimit ? (
            <p className="text-[13px]" style={{ color: 'var(--color-warning)' }}>
              Hastane limiti dolu ({group.maxOrganizations}). Yeni hastane eklemek için limiti artırın.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
                className="h-10 flex-1 rounded-xl border px-3 text-[13px] outline-none"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Bağımsız hastane seç…</option>
                {availableOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                ))}
              </select>
              <Button onClick={attach} disabled={!attachId || busy} className="gap-1 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: 'var(--color-primary)' }}>
                <Plus className="h-4 w-4" /> Ekle
              </Button>
            </div>
          )}
          {availableOrgs.length === 0 && !atLimit && (
            <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>Bağlanabilecek bağımsız hastane yok (tüm hastaneler ya bir gruba bağlı ya demo).</p>
          )}
        </div>
      </BlurFade>

      {/* Attached hospitals */}
      <BlurFade delay={0.07}>
        <div className="space-y-2">
          <h3 className="text-[13px] font-bold px-1" style={{ color: 'var(--color-text-secondary)' }}>
            Grup Hastaneleri ({group._count.organizations})
          </h3>
          {group.organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <Boxes className="h-6 w-6 mb-2" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Bu gruba henüz hastane bağlanmadı</p>
            </div>
          ) : (
            group.organizations.map((o) => (
              <div key={o.id} className="flex items-center gap-4 rounded-2xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-bg)' }}>
                  <Building2 className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold truncate">{o.name}</p>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>{o.code}</span>
                  </div>
                  <p className="text-[12px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <User className="h-3.5 w-3.5" /> {o._count.users} personel
                  </p>
                </div>
                {o.isSuspended && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>Askıda</span>
                )}
                <Button variant="outline" size="sm" onClick={() => detach(o.id)} disabled={busy} className="gap-1 rounded-lg" style={{ color: 'var(--color-error)' }}>
                  <X className="h-4 w-4" /> Çıkar
                </Button>
              </div>
            ))
          )}
        </div>
      </BlurFade>
    </div>
  );
}
