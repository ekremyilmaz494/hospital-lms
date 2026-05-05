'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { UserCog, UserPlus, ShieldCheck, Mail, AlertCircle } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { InviteAdminModal } from './_components/invite-admin-modal';

interface AdminListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  isOwner: boolean;
}

interface AdminsPayload {
  ownerUserId: string | null;
  maxAdmins: number;
  activeAdminCount: number;
  admins: AdminListItem[];
}

export default function YoneticilerPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data, isLoading, refetch } = useFetch<AdminsPayload>('/api/admin/users');

  const isOwner = useMemo(
    () => !!data && !!user && data.ownerUserId === user.id,
    [data, user],
  );

  // Owner değilse panele yönlendir — owner-only sayfa
  if (!authLoading && user && data && data.ownerUserId !== null && data.ownerUserId !== user.id) {
    if (typeof window !== 'undefined') {
      router.replace('/admin/dashboard');
    }
    return null;
  }

  if (authLoading || isLoading || !data) {
    return <PageLoading />;
  }

  const limitReached = data.activeAdminCount >= data.maxAdmins;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--k-primary) 12%, transparent)', color: 'var(--k-primary)' }}
          >
            <UserCog className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--k-text-primary)' }}>
              Yönetici Yönetimi
            </h1>
            <p className="text-sm" style={{ color: 'var(--k-text-muted)' }}>
              Bu organizasyona ait yöneticileri görüntüleyin ve yeni yönetici davet edin.
            </p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              if (limitReached) {
                toast(`Yönetici limiti dolu (${data.maxAdmins}). Limit yükseltmek için Klinova ile iletişime geçin.`, 'error');
                return;
              }
              setShowInviteModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: limitReached ? 'var(--k-border)' : 'var(--k-primary)',
              color: limitReached ? 'var(--k-text-muted)' : '#fff',
              cursor: limitReached ? 'not-allowed' : 'pointer',
            }}
            disabled={limitReached}
          >
            <UserPlus className="h-4 w-4" />
            Yönetici Davet Et
          </button>
        )}
      </div>

      {/* Sayaç + uyarı kartı */}
      <div
        className="rounded-2xl p-5 border"
        style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--k-primary) 12%, transparent)', color: 'var(--k-primary)' }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: 'var(--k-text-muted)' }}>
                Yönetici Kullanımı
              </span>
              <span className="text-2xl font-bold" style={{ color: 'var(--k-text-primary)' }}>
                {data.activeAdminCount} / {data.maxAdmins}
              </span>
            </div>
          </div>
          {limitReached && (
            <div
              className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
              style={{ background: '#fef3c7', color: '#92400e' }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Limit dolu. Yeni yönetici eklemek için Klinova ile iletişime geçin.</span>
            </div>
          )}
        </div>
      </div>

      {/* Yönetici listesi */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
      >
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wider"
                style={{ background: 'var(--k-surface-muted, #fafaf9)', color: 'var(--k-text-muted)' }}>
              <th className="px-5 py-3">Ad Soyad</th>
              <th className="px-5 py-3">E-posta</th>
              <th className="px-5 py-3">Unvan</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Eklenme</th>
            </tr>
          </thead>
          <tbody>
            {data.admins.map((a) => (
              <tr key={a.id} className="border-t" style={{ borderColor: 'var(--k-border)' }}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--k-text-primary)' }}>
                      {a.firstName} {a.lastName}
                    </span>
                    {a.isOwner && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                        style={{ background: 'var(--k-primary)', color: '#fff' }}
                        title="Esas Yönetici — yeni admin davet etme yetkisine sahiptir"
                      >
                        Esas Yönetici
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-sm flex items-center gap-1.5" style={{ color: 'var(--k-text-secondary)' }}>
                  <Mail className="h-3.5 w-3.5" style={{ color: 'var(--k-text-muted)' }} />
                  {a.email}
                </td>
                <td className="px-5 py-3 text-sm" style={{ color: 'var(--k-text-secondary)' }}>
                  {a.title ?? '—'}
                </td>
                <td className="px-5 py-3">
                  <span
                    className="text-xs font-semibold rounded-full px-2.5 py-1"
                    style={{
                      background: a.isActive ? '#dcfce7' : '#fee2e2',
                      color: a.isActive ? '#166534' : '#991b1b',
                    }}
                  >
                    {a.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm" style={{ color: 'var(--k-text-muted)' }}>
                  {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInviteModal && (
        <InviteAdminModal
          onClose={() => setShowInviteModal(false)}
          onSaved={() => { refetch(); }}
          maxAdmins={data.maxAdmins}
          currentCount={data.activeAdminCount}
        />
      )}
    </div>
  );
}
