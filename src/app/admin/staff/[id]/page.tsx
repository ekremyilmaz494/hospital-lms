'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, TrendingUp, Briefcase, Edit, Mail, Phone, Building2, Shield, RotateCcw, Plus } from 'lucide-react';
import { AssignTrainingModal } from '../assign-training-modal';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface StaffDetail {
  id: string;
  name: string;
  email: string;
  tcNo: string;
  department: string;
  title: string;
  phone: string;
  initials: string;
  stats: { assignedTrainings: number; completedTrainings: number; successRate: string; avgScore: string };
  trainingHistory: { trainingId: string; title: string; attempt: number; maxAttempts: number; preScore: number | null; postScore: number | null; status: string; date: string }[];
}

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  passed: { label: 'Başarılı', bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  failed: { label: 'Başarısız', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
  in_progress: { label: 'Devam Ediyor', bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  assigned: { label: 'Atandı', bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  locked: { label: 'Kilitli', bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { toast } = useToast();
  const { data: staff, isLoading, error, refetch } = useFetch<StaffDetail>(id ? `/api/admin/staff/${id}` : null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!staff) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Personel bulunamadı</div></div>;
  }

  const profileInfo = [
    { icon: Mail, label: 'E-posta', value: staff.email },
    { icon: Phone, label: 'Telefon', value: staff.phone, mono: true },
    { icon: Shield, label: 'TC Kimlik', value: staff.tcNo, mono: true },
    { icon: Building2, label: 'Departman', value: staff.department },
    { icon: Briefcase, label: 'Unvan', value: staff.title },
  ];

  const trainingHistory = staff.trainingHistory ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar className="h-14 w-14 ring-4" style={{ '--tw-ring-color': 'var(--color-primary-light)' } as React.CSSProperties}>
              <AvatarFallback className="text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}>{staff.initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{staff.name}</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {staff.title} • {staff.department}
              </p>
            </div>
          </div>
          <Link href={`/admin/staff/${staff.id}/edit`}>
            <Button variant="outline" className="gap-2 rounded-xl" style={{ borderColor: 'var(--color-border)' }}>
              <Edit className="h-4 w-4" /> Düzenle
            </Button>
          </Link>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Atanan Eğitim', value: staff.stats?.assignedTrainings ?? 0, icon: GraduationCap, accentColor: 'var(--color-info)' },
          { title: 'Tamamlanan', value: staff.stats?.completedTrainings ?? 0, icon: TrendingUp, accentColor: 'var(--color-success)' },
          { title: 'Başarı Oranı', value: staff.stats?.successRate ?? '0%', icon: TrendingUp, accentColor: 'var(--color-primary)' },
          { title: 'Ort. Puan', value: staff.stats?.avgScore ?? '0', icon: TrendingUp, accentColor: 'var(--color-accent)' },
        ].map((s, i) => (
          <BlurFade key={s.title} delay={0.05 + i * 0.05}>
            <StatCard {...s} />
          </BlurFade>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Personal Info */}
        <BlurFade delay={0.25}>
          <ShineBorder color={['#0d9668', '#f59e0b']} borderWidth={1.5} duration={10} className="rounded-2xl">
            <div className="p-5">
              <h3 className="mb-4 text-sm font-bold">Kişisel Bilgiler</h3>
              <div className="space-y-3">
                {profileInfo.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--color-surface-hover)]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-surface-hover)' }}>
                      <item.icon className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                      <p className={`text-sm font-medium ${item.mono ? 'font-mono' : ''}`} style={{ color: 'var(--color-text-secondary)' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ShineBorder>
        </BlurFade>

        {/* Training History */}
        <BlurFade delay={0.3} className="lg:col-span-2">
          <MagicCard gradientColor="rgba(13, 150, 104, 0.04)" gradientOpacity={0.3} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="p-5">
              <h3 className="mb-4 text-sm font-bold">Eğitim Geçmişi</h3>
              {trainingHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--color-bg)', borderRadius: '8px' }}>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Deneme</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ön</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                        <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingHistory.map((t, i) => {
                        const st = statusMap[t.status] || statusMap.assigned;
                        return (
                          <tr key={i} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="px-3 py-3 font-semibold">{t.title}</td>
                            <td className="px-3 py-3 font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t.attempt}/{t.maxAttempts}</td>
                            <td className="px-3 py-3 font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>{t.preScore !== null ? `${t.preScore}%` : '—'}</td>
                            <td className="px-3 py-3 font-mono text-sm font-bold" style={{ color: t.status === 'passed' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{t.postScore !== null ? `${t.postScore}%` : '—'}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: st.bg, color: st.text }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.text }} />
                                {st.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.date}</td>
                            <td className="px-3 py-3">
                              {(t.status === 'failed' || t.status === 'locked') && (
                                <Button variant="ghost" size="sm" className="gap-1.5 text-xs rounded-lg" style={{ color: 'var(--color-primary)' }}
                                  onClick={async () => {
                                    const confirmed = window.confirm(`"${t.title}" eğitimi için ${staff!.name} adlı personele 1 ek deneme hakkı verilecek. Onaylıyor musunuz?`);
                                    if (!confirmed) return;
                                    try {
                                      const res = await fetch(`/api/admin/trainings/${t.trainingId}/assignments`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ userId: id, additionalAttempts: 1 }),
                                      });
                                      if (!res.ok) {
                                        const body = await res.json().catch(() => ({}));
                                        throw new Error(body.error || 'İşlem başarısız');
                                      }
                                      toast('Ek deneme hakkı verildi', 'success');
                                      refetch();
                                    } catch (err) {
                                      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
                                    }
                                  }}
                                >
                                  <RotateCcw className="h-3 w-3" /> Yeni Hak
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--color-info-bg)' }}>
                    <GraduationCap className="h-6 w-6" style={{ color: 'var(--color-info)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Bu personele henüz eğitim atanmadı.</p>
                  <Button variant="outline" size="sm" className="gap-2 rounded-lg" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }} onClick={() => setAssignModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Eğitim Ata
                  </Button>
                </div>
              )}
            </div>
          </MagicCard>
        </BlurFade>
      </div>
      {staff && (
        <AssignTrainingModal
          staffId={staff.id}
          staffName={staff.name}
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
