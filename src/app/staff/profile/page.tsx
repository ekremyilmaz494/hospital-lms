'use client';

import { useState } from 'react';
import { User, Mail, Phone, Building2, Shield, Camera, Save } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShineBorder } from '@/components/ui/shine-border';
import { MagicCard } from '@/components/ui/magic-card';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hospital: string;
  tcKimlik: string;
  department: string;
  title: string;
}

export default function ProfilePage() {
  const { fullName, initials } = useAuth();
  const { data: profile, isLoading, error } = useFetch<ProfileData>('/api/staff/profile');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Populate form when data loads
  const [initialized, setInitialized] = useState(false);
  if (profile && !initialized) {
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setPhone(profile.phone ?? '');
    setInitialized(true);
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: Record<string, string> = { firstName, lastName, phone };
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setSaveError('Yeni şifreler eşleşmiyor');
          setSaving(false);
          return;
        }
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch('/api/staff/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kaydetme başarısız');
      }
      setSaveSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  const profileInfo = [
    { icon: Mail, label: 'E-posta', value: profile?.email ?? '', mono: false },
    { icon: Phone, label: 'Telefon', value: profile?.phone ?? '', mono: true },
    { icon: Building2, label: 'Hastane', value: profile?.hospital ?? '', mono: false },
    { icon: Shield, label: 'TC Kimlik', value: profile?.tcKimlik ?? '', mono: true },
  ];

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : fullName;
  const displayInitials = profile ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() : initials;

  return (
    <div className="space-y-6">
      <PageHeader title="Profilim" subtitle="Kişisel bilgilerinizi görüntüleyin ve düzenleyin" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <BlurFade delay={0.05}>
          <ShineBorder
            className="rounded-2xl border p-6 text-center"
            color={['#0d9668', '#f59e0b']}
            borderWidth={1.5}
            duration={10}
          >
            <div className="relative mx-auto mb-5 h-28 w-28">
              <Avatar className="h-28 w-28 ring-4" style={{ '--tw-ring-color': 'var(--color-primary-light)' } as React.CSSProperties}>
                <AvatarFallback className="text-3xl font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}>
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-3 shadow-md transition-transform duration-200 hover:scale-110"
                style={{ background: 'var(--color-primary)', borderColor: 'var(--color-surface)' }}
              >
                <Camera className="h-4 w-4 text-white" />
              </button>
            </div>

            <h3 className="text-lg font-bold">{displayName}</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{profile?.title ?? ''}</p>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
              {profile?.department ?? ''}
            </div>

            <div className="my-5 h-px" style={{ background: 'var(--color-border)' }} />

            <div className="space-y-3 text-left">
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
          </ShineBorder>
        </BlurFade>

        {/* Edit Forms */}
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.1}>
            <MagicCard gradientColor="rgba(13, 150, 104, 0.04)" gradientOpacity={0.3} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="p-6">
                <h3 className="mb-5 text-base font-bold">Kişisel Bilgiler</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Ad</Label>
                      <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Soyad</Label>
                      <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                    <Input value={profile?.email ?? ''} disabled className="h-11 rounded-xl" style={{ background: 'var(--color-surface-hover)', borderColor: 'var(--color-border)' }} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </div>
                </div>
              </div>
            </MagicCard>
          </BlurFade>

          <BlurFade delay={0.15}>
            <MagicCard gradientColor="rgba(245, 158, 11, 0.04)" gradientOpacity={0.3} className="rounded-2xl border p-0" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="p-6">
                <h3 className="mb-5 text-base font-bold">Şifre Değiştir</h3>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Mevcut Şifre</Label>
                    <Input type="password" placeholder="••••••••" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre</Label>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre (Tekrar)</Label>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                  </div>
                </form>
              </div>
            </MagicCard>
          </BlurFade>

          {saveError && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>Değişiklikler kaydedildi.</p>
          )}

          <BlurFade delay={0.2}>
            <div className="flex justify-end">
              <ShimmerButton
                className="gap-2 text-sm font-semibold"
                borderRadius="12px"
                background="linear-gradient(135deg, #0d9668, #065f46)"
                shimmerColor="rgba(255,255,255,0.15)"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </ShimmerButton>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
