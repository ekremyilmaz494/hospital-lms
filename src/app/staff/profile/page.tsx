'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Phone, Building2, Shield, Camera, Save, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Calendar, Award, BookOpen, FileText,
  Lock, Loader2, Briefcase, Bell, BellOff,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  hospital: string;
  department: string;
  title: string;
  avatarUrl: string;
  stats: { assignments: number; exams: number; certificates: number };
  createdAt: string;
}

/** VAPID public key'i Uint8Array'e çevirir (PushManager.subscribe için gerekli) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { fullName, initials } = useAuth();
  const { data: profile, isLoading, error, refetch } = useFetch<ProfileData>('/api/staff/profile');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Sadece resim dosyaları yüklenebilir', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Dosya boyutu 2MB\'ı aşamaz', 'error');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      toast('Fotoğraf güncellendi', 'success');
      refetch();
    } catch {
      toast('Fotoğraf yüklenemedi', 'error');
    }
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // ── Push Bildirimleri ──
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Initialize form when profile data arrives
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  // Push bildirim desteğini ve mevcut aboneliği kontrol et
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushSupported(true);
    // Zaten izin verildi mi ve aktif abonelik var mı?
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => { if (sub) setPushEnabled(true); })
        .catch(() => {});
    }
  }, []);

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // Aboneliği iptal et
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/staff/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        toast('Anlık bildirimler devre dışı bırakıldı', 'success');
      } else {
        // İzin iste
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.', 'error');
          return;
        }
        // Abone ol
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
        if (!vapidKey) { toast('Push bildirimleri yapılandırılmamış', 'error'); return; }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
        });
        const json = sub.toJSON();
        await fetch('/api/staff/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          }),
        });
        setPushEnabled(true);
        toast('Anlık bildirimler aktif edildi', 'success');
      }
    } catch {
      toast('Bildirim ayarı değiştirilemedi', 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast('Ad ve soyad alanları boş bırakılamaz', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Kaydetme başarısız');
      }
      toast('Profil bilgileri güncellendi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast('Mevcut şifrenizi girin', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast('Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Yeni şifreler eşleşmiyor', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Şifre değiştirilemedi');
      }
      toast('Şifreniz başarıyla güncellendi', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : fullName;
  const displayInitials = profile ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() : initials;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    : '';

  const inputClass = 'h-11 rounded-xl text-[13px] transition-shadow duration-200 focus:ring-2 focus:ring-[var(--color-primary)]/20';
  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
            }}
          >
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Profilim
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Kişisel bilgilerinizi görüntüleyin ve düzenleyin
            </p>
          </div>
        </div>
      </BlurFade>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* ─── Left: Profile Card ─── */}
        <div className="space-y-4">
          <BlurFade delay={0.03}>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              {/* Banner */}
              <div
                className="relative h-24"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--brand-800) 60%, #0a3d2e 100%)',
                }}
              >
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)' }} />
              </div>

              {/* Avatar + Name */}
              <div className="relative px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  <Avatar
                    className="h-24 w-24 ring-4"
                    style={{ '--tw-ring-color': 'var(--color-surface)' } as React.CSSProperties}
                  >
                    <AvatarFallback
                      className="text-2xl font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' }}
                    >
                      {displayInitials}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    className="absolute bottom-0 left-16 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 shadow-md transition-transform duration-200 hover:scale-110 active:scale-95"
                    style={{ background: 'var(--color-primary)', borderColor: 'var(--color-surface)', color: 'white' }}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                </div>

                <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  {displayName}
                </h3>
                {profile?.title && (
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {profile.title}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {profile?.department && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                      {profile.department}
                    </span>
                  )}
                  {memberSince && (
                    <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      {memberSince}&apos;den beri
                    </span>
                  )}
                </div>

                {/* Info rows */}
                <div className="mt-5 space-y-1">
                  {[
                    { icon: Mail, label: 'E-posta', value: profile?.email ?? '' },
                    { icon: Phone, label: 'Telefon', value: profile?.phone || '—' },
                    { icon: Building2, label: 'Hastane', value: profile?.hospital ?? '' },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: 'var(--color-bg)' }}
                      >
                        <item.icon className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                          {item.label}
                        </p>
                        <p className={`text-[13px] font-medium truncate ${'mono' in item && item.mono ? 'font-mono' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </BlurFade>

          {/* Stats */}
          <BlurFade delay={0.06}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Eğitim', value: profile?.stats?.assignments ?? 0, icon: BookOpen, color: 'var(--color-info)' },
                { label: 'Sınav', value: profile?.stats?.exams ?? 0, icon: FileText, color: 'var(--color-warning)' },
                { label: 'Sertifika', value: profile?.stats?.certificates ?? 0, icon: Award, color: 'var(--color-success)' },
              ].map(s => (
                <div
                  key={s.label}
                  className="flex flex-col items-center rounded-xl p-3"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg mb-1.5"
                    style={{ background: `${s.color}12` }}
                  >
                    <s.icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <p className="text-lg font-bold font-mono">{s.value}</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </BlurFade>
        </div>

        {/* ─── Right: Edit Forms ─── */}
        <div className="space-y-5">
          {/* Personal Info */}
          <BlurFade delay={0.06}>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                    <Briefcase className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold">Kişisel Bilgiler</h3>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Ad, soyad ve iletişim bilgileriniz</p>
                  </div>
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="hidden sm:flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)',
                  }}
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingProfile ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <User className="h-3 w-3" /> Ad
                    </Label>
                    <Input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Adınız"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <User className="h-3 w-3" /> Soyad
                    </Label>
                    <Input
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Soyadınız"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <Mail className="h-3 w-3" /> E-posta
                  </Label>
                  <Input
                    value={profile?.email ?? ''}
                    disabled
                    className={`${inputClass} cursor-not-allowed`}
                    style={{ ...inputStyle, background: 'var(--color-surface-hover)', opacity: 0.7 }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    E-posta adresi yönetici tarafından belirlenir
                  </p>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <Phone className="h-3 w-3" /> Telefon
                  </Label>
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="+90 (___) ___ __ __"
                  />
                </div>
                {/* Mobile save button — at bottom of form */}
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex sm:hidden w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.2 * 100%), transparent)',
                  }}
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingProfile ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </BlurFade>

          {/* Password Change */}
          <BlurFade delay={0.1}>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-warning-bg)' }}>
                    <Lock className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold">Şifre Değiştir</h3>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Hesap güvenliğiniz için şifrenizi güncelleyin</p>
                  </div>
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword || (!currentPassword && !newPassword)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: (currentPassword && newPassword) ? 'var(--color-warning-bg)' : 'var(--color-bg)',
                    color: (currentPassword && newPassword) ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    border: `1px solid ${(currentPassword && newPassword) ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  }}
                >
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {savingPassword ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <Lock className="h-3 w-3" /> Mevcut Şifre
                  </Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Mevcut şifreniz"
                      className={`${inputClass} pr-11`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <Lock className="h-3 w-3" /> Yeni Şifre
                    </Label>
                    <div className="relative">
                      <Input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="En az 6 karakter"
                        className={`${inputClass} pr-11`}
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <Lock className="h-3 w-3" /> Tekrar
                    </Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Yeni şifreyi tekrar girin"
                      className={inputClass}
                      style={inputStyle}
                    />
                    {confirmPassword && newPassword && confirmPassword !== newPassword && (
                      <p className="flex items-center gap-1 text-[10px] mt-1" style={{ color: 'var(--color-error)' }}>
                        <AlertTriangle className="h-3 w-3" /> Şifreler eşleşmiyor
                      </p>
                    )}
                    {confirmPassword && newPassword && confirmPassword === newPassword && (
                      <p className="flex items-center gap-1 text-[10px] mt-1" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle2 className="h-3 w-3" /> Şifreler eşleşiyor
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </BlurFade>

          {/* ─── MFA / 2FA ─── */}
          <BlurFade delay={0.5}>
            <div className="rounded-2xl border p-7" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-info-bg)' }}>
                  <Shield className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>İki Faktörlü Doğrulama (2FA)</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Hesabınızı ek güvenlik katmanıyla koruyun</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Authenticator Uygulaması</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Google Authenticator veya benzeri uygulama ile 6 haneli kod</p>
                </div>
                <a
                  href="/auth/mfa-setup"
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                >
                  Ayarla
                </a>
              </div>
            </div>
          </BlurFade>

          {/* ─── Anlık Bildirimler ─── */}
          {pushSupported && (
            <BlurFade delay={0.6}>
              <div className="rounded-2xl border p-7" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: pushEnabled ? 'var(--color-primary-light)' : 'var(--color-surface-hover)' }}>
                    {pushEnabled
                      ? <Bell className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                      : <BellOff className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
                    }
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
                      Anlık Bildirimler
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Yeni eğitim ve sınav atamalarında anında haberdar olun
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-4"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {pushEnabled ? 'Bildirimler Açık' : 'Bildirimler Kapalı'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {pushEnabled
                        ? 'Bu cihazda anlık bildirim alıyorsunuz'
                        : 'Eğitim ve sınav bildirimlerini alın'}
                    </p>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={handleTogglePush}
                    disabled={pushLoading}
                    className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:opacity-50"
                    style={{ background: pushEnabled ? 'var(--color-primary)' : 'var(--color-border)' }}
                    aria-label={pushEnabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: pushEnabled ? 'translateX(20px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>

                {Notification.permission === 'denied' && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-warning)' }}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Tarayıcıda bildirim izni reddedilmiş. Adres çubuğundaki kilit simgesinden izin verebilirsiniz.
                  </p>
                )}
              </div>
            </BlurFade>
          )}
        </div>
      </div>
    </div>
  );
}
