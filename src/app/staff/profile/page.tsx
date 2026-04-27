'use client';

/**
 * Profilim — "Clinical Editorial" redesign.
 * Notifications + Calendar + SMG ile aynı dil: cream + ink + gold + mono caps + serif display.
 * Hero identity + numaralı bölüm mimarisi (I. Bilgiler · II. Güvenlik · III. 2FA).
 */

import { useState, useEffect, useRef } from 'react';
import {
  Mail, Phone, Building2, Shield, Camera, Eye, EyeOff,
  CheckCircle2, AlertTriangle, Award, BookOpen, FileText,
  Lock, Loader2, Briefcase,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/components/shared/toast';
import { INK, INK_SOFT, CREAM, RULE, GOLD, OLIVE, CARD_BG } from '@/lib/editorial-palette';

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

export default function ProfilePage() {
  const { toast } = useToast();
  const { fullName, initials } = useAuth();
  const { data: profile, isLoading, error, refetch } = useFetch<ProfileData>('/api/staff/profile');
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

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
      const res = await fetch('/api/staff/profile', { method: 'PATCH', body: formData });
      if (!res.ok) throw new Error('Yükleme başarısız');
      toast('Fotoğraf güncellendi', 'success');
      refetch();
    } catch {
      toast('Fotoğraf yüklenemedi', 'error');
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
    if (!currentPassword) { toast('Mevcut şifrenizi girin', 'error'); return; }
    if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast('Şifre en az 8 karakter, bir büyük harf ve bir rakam içermelidir', 'error');
      return;
    }
    if (newPassword !== confirmPassword) { toast('Yeni şifreler eşleşmiyor', 'error'); return; }
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
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : fullName;
  const displayInitials = profile
    ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()
    : initials;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-8 pb-16 max-w-6xl">
        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b pb-5"
          style={{ borderColor: INK }}
        >
          <div className="flex items-end gap-4">
            <h1
              className="text-[28px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              hesap bilgileri<span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          {memberSince && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              ÜYE SİCİLİ · {memberSince.toUpperCase()}
            </span>
          )}
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Kişisel bilgiler · güvenlik · tercihler
        </p>

        {isLoading ? (
          <ProfileSkeleton />
        ) : error ? (
          <p className="mt-10 text-[13px]" style={{ color: '#b3261e' }}>{error}</p>
        ) : (
          <>
            {/* ───── HERO: Identity ───── */}
            <section className="mt-10">
              <div
                className="flex flex-col gap-6 md:grid md:gap-8 md:items-center"
                style={{ gridTemplateColumns: 'max-content minmax(0, 1fr)' }}
              >
                {/* Avatar */}
                <div className="relative inline-block">
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      width: 128, height: 128,
                      backgroundColor: OLIVE,
                      border: `2px solid ${INK}`,
                      borderRadius: '4px',
                    }}
                  >
                    {profile?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        style={{ borderRadius: '2px' }}
                      />
                    ) : (
                      <span
                        className="text-[44px] font-semibold tracking-[-0.02em]"
                        style={{
                          color: CREAM,
                          fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                        }}
                      >
                        {displayInitials}
                      </span>
                    )}
                    {/* Gold corner mark */}
                    <span
                      aria-hidden
                      className="absolute -top-[2px] -right-[2px]"
                      style={{
                        width: 14, height: 14,
                        backgroundColor: GOLD,
                        border: `2px solid ${INK}`,
                      }}
                    />
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="Profil fotoğrafı yükle"
                    className="absolute -bottom-1 -right-1 flex items-center justify-center transition-colors"
                    style={{
                      width: 32, height: 32,
                      backgroundColor: CREAM,
                      color: INK,
                      border: `1px solid ${INK}`,
                      borderRadius: '2px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = INK; e.currentTarget.style.color = CREAM; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = CREAM; e.currentTarget.style.color = INK; }}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                {/* Name + title + meta */}
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Kayıtlı personel
                  </p>
                  <h2
                    className="mt-1 text-[26px] sm:text-[40px] leading-[0.95] font-semibold tracking-[-0.025em]"
                    style={{
                      color: INK,
                      fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
                    }}
                  >
                    {displayName}
                  </h2>
                  {profile?.title && (
                    <p className="mt-1 text-[14px]" style={{ color: INK_SOFT }}>
                      {profile.title}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile?.department && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
                        style={{
                          color: OLIVE,
                          backgroundColor: '#e8efe9',
                          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                        }}
                      >
                        <Briefcase className="h-3 w-3" />
                        {profile.department}
                      </span>
                    )}
                    {profile?.hospital && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase"
                        style={{
                          color: INK_SOFT,
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                        }}
                      >
                        <Building2 className="h-3 w-3" />
                        {profile.hospital}
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Stats strip — hero altında yatay satır */}
              <div
                className="mt-6 grid grid-cols-3"
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${RULE}`,
                  borderRadius: '4px',
                }}
              >
                <StatPill icon={BookOpen} label="Eğitim" value={profile?.stats?.assignments ?? 0} orientation="horizontal" />
                <StatPill icon={FileText} label="Sınav" value={profile?.stats?.exams ?? 0} orientation="horizontal" />
                <StatPill icon={Award} label="Sertifika" value={profile?.stats?.certificates ?? 0} orientation="horizontal" last />
              </div>
            </section>

            {/* ───── I. Kişisel bilgiler ───── */}
            <Section number="I." title="Kişisel bilgiler" subtitle="Ad, soyad ve iletişim bilgilerin">
              <div
                className="p-5 sm:p-6"
                style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}`, borderRadius: '4px' }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <EditorialField label="Ad">
                    <EditorialInput value={firstName} onChange={setFirstName} placeholder="Adınız" />
                  </EditorialField>
                  <EditorialField label="Soyad">
                    <EditorialInput value={lastName} onChange={setLastName} placeholder="Soyadınız" />
                  </EditorialField>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <EditorialField label="E-posta" icon={Mail} locked>
                    <EditorialInput value={profile?.email ?? ''} onChange={() => {}} disabled />
                    <p
                      className="mt-1 text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      Yönetici tarafından atanır
                    </p>
                  </EditorialField>
                  <EditorialField label="Telefon" icon={Phone}>
                    <EditorialInput
                      value={phone}
                      onChange={setPhone}
                      placeholder="+90 (___) ___ __ __"
                    />
                  </EditorialField>
                </div>
                <div
                  className="mt-6 flex items-center justify-end gap-3 pt-4 border-t"
                  style={{ borderColor: RULE }}
                >
                  <EditorialButton
                    onClick={handleSaveProfile}
                    loading={savingProfile}
                    label={savingProfile ? 'Kaydediliyor' : 'Kaydet'}
                  />
                </div>
              </div>
            </Section>

            {/* ───── II. Şifre değiştir ───── */}
            <Section number="II." title="Şifre güncelle" subtitle="Hesap güvenliğin için düzenli değiştir">
              <div
                className="p-5 sm:p-6"
                style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}`, borderRadius: '4px' }}
              >
                <EditorialField label="Mevcut şifre" icon={Lock}>
                  <div className="relative">
                    <EditorialInput
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="Mevcut şifreniz"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: INK_SOFT }}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </EditorialField>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <EditorialField label="Yeni şifre" icon={Lock}>
                    <div className="relative">
                      <EditorialInput
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="En az 8 karakter"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                        style={{ color: INK_SOFT }}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </EditorialField>
                  <EditorialField label="Tekrar" icon={Lock}>
                    <EditorialInput
                      type="password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Yeni şifreyi tekrar gir"
                      autoComplete="new-password"
                    />
                    {confirmPassword && newPassword && confirmPassword !== newPassword && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]"
                        style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>
                        <AlertTriangle className="h-3 w-3" />
                        Şifreler eşleşmiyor
                      </p>
                    )}
                    {confirmPassword && newPassword && confirmPassword === newPassword && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]"
                        style={{ color: '#0a7a47', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>
                        <CheckCircle2 className="h-3 w-3" />
                        Eşleşiyor
                      </p>
                    )}
                  </EditorialField>
                </div>
                <div
                  className="mt-6 flex items-center justify-end gap-3 pt-4 border-t"
                  style={{ borderColor: RULE }}
                >
                  <EditorialButton
                    onClick={handleChangePassword}
                    loading={savingPassword}
                    label={savingPassword ? 'Güncelleniyor' : 'Şifreyi Güncelle'}
                    disabled={!currentPassword || !newPassword}
                  />
                </div>
              </div>
            </Section>

            {/* ───── III. 2FA ───── */}
            <Section number="III." title="İki faktörlü doğrulama" subtitle="Hesabını ek katmanla koru">
              <div
                className="grid items-center gap-4 p-5 sm:p-6"
                style={{
                  backgroundColor: CARD_BG,
                  border: `1px solid ${RULE}`,
                  borderRadius: '4px',
                  gridTemplateColumns: '44px 1fr max-content',
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44, backgroundColor: '#eef2fb', borderRadius: '2px' }}
                >
                  <Shield className="h-5 w-5" style={{ color: '#2c55b8' }} />
                </div>
                <div>
                  <p
                    className="text-[14px] font-semibold tracking-[-0.01em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Authenticator Uygulaması
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: INK_SOFT }}>
                    Google Authenticator veya benzeri uygulama ile 6 haneli kod.
                  </p>
                </div>
                <a
                  href="/auth/mfa-setup"
                  className="inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    color: CREAM,
                    backgroundColor: INK,
                    borderRadius: '2px',
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  Ayarla
                  <span style={{ color: GOLD }}>→</span>
                </a>
              </div>
            </Section>

          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function Section({
  number, title, subtitle, children,
}: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <header
        className="grid items-end gap-4 pb-3 border-b"
        style={{ gridTemplateColumns: '40px 1fr', borderColor: RULE }}
      >
        <span
          className="text-[11px] font-semibold tracking-[0.2em]"
          style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {number}
        </span>
        <div>
          <h3
            className="text-[20px] leading-tight font-semibold tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {title}
          </h3>
          <p
            className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {subtitle}
          </p>
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatPill({
  icon: Icon, label, value, last, orientation = 'vertical',
}: {
  icon: typeof BookOpen; label: string; value: number; last?: boolean;
  orientation?: 'vertical' | 'horizontal';
}) {
  const divider = orientation === 'horizontal'
    ? { borderRight: last ? 'none' : `1px solid ${RULE}` }
    : { borderBottom: last ? 'none' : `1px solid ${RULE}` };
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={divider}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 28, height: 28, backgroundColor: CREAM, borderRadius: '2px' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: INK_SOFT }} />
      </div>
      <div className="flex-1 flex items-baseline justify-between gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {label}
        </span>
        <span
          className="text-[20px] font-semibold tabular-nums tracking-[-0.02em]"
          style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
        >
          {value.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

function EditorialField({
  label, icon: Icon, children, locked,
}: { label: string; icon?: typeof Mail; children: React.ReactNode; locked?: boolean }) {
  return (
    <div>
      <label
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {locked && <Lock className="h-2.5 w-2.5 ml-1" />}
      </label>
      {children}
    </div>
  );
}

function EditorialInput({
  value, onChange, placeholder, type = 'text', disabled, autoComplete,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean; autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      className="w-full text-[13px] px-3 py-2.5 focus:outline-none focus:ring-0"
      style={{
        backgroundColor: disabled ? 'rgba(0,0,0,0.03)' : CREAM,
        color: disabled ? INK_SOFT : INK,
        border: `1px solid ${RULE}`,
        borderRadius: '2px',
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}

function EditorialButton({
  onClick, loading, label, disabled,
}: { onClick: () => void; loading: boolean; label: string; disabled?: boolean }) {
  const isDisabled = loading || disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
      style={{
        color: CREAM,
        backgroundColor: isDisabled ? '#6b7280' : INK,
        borderRadius: '2px',
        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.backgroundColor = OLIVE; }}
      onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.backgroundColor = INK; }}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
      {!loading && <span style={{ color: GOLD }}>→</span>}
    </button>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label = score < 2 ? 'ZAYIF' : score === 2 ? 'ORTA' : 'GÜÇLÜ';
  const color = score < 2 ? '#b3261e' : score === 2 ? '#b4820b' : '#0a7a47';
  return (
    <div className="mt-2">
      <div
        className="relative h-[3px] w-full overflow-hidden"
        style={{ backgroundColor: RULE, borderRadius: '1px' }}
      >
        <div
          className="absolute left-0 top-0 h-full transition-all"
          style={{
            width: `${(score / 3) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <p
        className="mt-1 text-[10px] uppercase tracking-[0.14em] font-semibold"
        style={{ color, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        Güç: {label}
      </p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-10 space-y-10">
      <div className="grid gap-8 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div style={{ width: 128, height: 128, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px' }} />
        <div>
          <div className="h-3 w-40" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '2px' }} />
          <div className="mt-3 h-10 w-3/4" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '2px' }} />
        </div>
        <div className="h-[160px] w-[180px]" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-48 w-full" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
      ))}
    </div>
  );
}
