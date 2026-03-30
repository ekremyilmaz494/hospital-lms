'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft, Users, GraduationCap, TrendingUp,
  Edit, Ban, Calendar, Activity, UserCog, LogIn,
} from 'lucide-react';
import { PageLoading } from '@/components/shared/page-loading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

interface HospitalDetail {
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
  admins?: { id: string; name: string; email: string; lastLogin: string }[];
  recentActivity?: { action: string; detail: string; time: string; user: string }[];
}

export default function HospitalDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useFetch<HospitalDetail>(`/api/super-admin/hospitals/${id}`);
  const { toast } = useToast();
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // G3.4 — Opens a magic-link session for the target user in a new tab
  const handleImpersonate = async (adminUser: { id: string; name: string; email: string }) => {
    setImpersonatingId(adminUser.id);
    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: adminUser.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Impersonation başarısız');
      window.open(body.actionLink, '_blank', 'noopener,noreferrer');
      toast(`"${adminUser.name}" olarak yeni sekmede açıldı`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setImpersonatingId(null);
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

  const hospital = data;
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
              {hospital.name?.slice(0, 2).toUpperCase() ?? ''}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold truncate">
              {hospital.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{hospital.code}</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                Aktif
              </span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                {hospital.plan}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <Edit className="h-4 w-4" /> Düzenle
          </Button>
          <Button variant="outline" className="gap-2 text-red-500" style={{ borderColor: 'var(--color-border)' }}>
            <Ban className="h-4 w-4" /> Askıya Al
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Toplam Personel" value={hospital.staffCount} icon={Users} accentColor="var(--color-primary)" />
        <StatCard title="Aktif Eğitim" value={hospital.trainingCount} icon={GraduationCap} accentColor="var(--color-accent)" />
        <StatCard title="Tamamlanma Oranı" value={`${hospital.completionRate}%`} icon={TrendingUp} accentColor="var(--color-success)" />
        <StatCard title="Abonelik Bitiş" value={hospital.expiresAt} icon={Calendar} accentColor="var(--color-info)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Hospital Info + Subscription */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold">İletişim Bilgileri</h3>
            <div className="space-y-3 text-sm">
              <div><span style={{ color: 'var(--color-text-muted)' }}>Adres:</span><p style={{ color: 'var(--color-text-primary)' }}>{hospital.address}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Telefon:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{hospital.phone}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>E-posta:</span><p style={{ color: 'var(--color-text-primary)' }}>{hospital.email}</p></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Kayıt Tarihi:</span><p style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{hospital.createdAt}</p></div>
            </div>
          </div>

          {/* Admin Users */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="mb-4 text-sm font-bold">Admin Kullanıcılar</h3>
            <div className="space-y-3">
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
                    title={`"${admin.name}" olarak giriş yap`}
                    disabled={impersonatingId === admin.id}
                    onClick={() => handleImpersonate(admin)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-opacity duration-150 disabled:opacity-40"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                  >
                    {impersonatingId === admin.id ? (
                      <span>...</span>
                    ) : (
                      <><UserCog className="h-3 w-3" /> Giriş</>
                    )}
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
    </div>
  );
}
