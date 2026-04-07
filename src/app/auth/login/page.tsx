'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn, Loader2, Shield, BookOpen, BarChart3, ChevronRight, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic from 'next/dynamic';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

const Particles = dynamic(() => import('@/components/ui/particles').then(m => ({ default: m.Particles })), { ssr: false });
const Ripple = dynamic(() => import('@/components/ui/ripple').then(m => ({ default: m.Ripple })), { ssr: false });
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useOrgBranding } from '@/hooks/use-org-branding';

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
};

const features = [
  { icon: BookOpen, title: 'Eğitim Yönetimi', desc: 'Video tabanlı eğitimler ve otomatik sınav sistemi' },
  { icon: BarChart3, title: 'Detaylı Raporlama', desc: 'Departman ve personel bazlı performans analizi' },
  { icon: Shield, title: 'Güvenli Altyapı', desc: 'Rol tabanlı erişim ve denetim kayıtları' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [kvkkError, setKvkkError] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const rawRedirect = searchParams.get('redirectTo');
  // Prevent open redirect — only allow relative paths starting with /
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const isTimeout = searchParams.get('reason') === 'timeout';

  // White-label branding: ?org=slug parametresiyle hastane markasi yuklenir
  const orgSlug = searchParams.get('org');
  const { branding } = useOrgBranding(orgSlug);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!kvkkAccepted) {
      setKvkkError(true);
      return;
    }
    setKvkkError(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      // If not rememberMe, mark session as tab-only (auth-provider clears on new tab)
      if (!rememberMe) {
        sessionStorage.setItem('lms_session_only', '1');
      } else {
        sessionStorage.removeItem('lms_session_only');
      }

      const data = await res.json();

      if (res.status === 429) {
        setError('Çok fazla giriş denemesi. 15 dakika bekleyin.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? 'E-posta veya şifre hatalı.');
        setLoading(false);
        return;
      }

      // MFA gerekiyorsa doğrulama sayfasına yönlendir (kullanıcı bilgisi MFA öncesi döndürülmez)
      if (data.mfaRequired) {
        router.push(`/auth/mfa-verify?factorId=${encodeURIComponent(data.factorId)}`);
        return;
      }

      const role = data.user?.role as string;
      const target = redirectTo && redirectTo !== '/' ? redirectTo : ROLE_ROUTES[role] || '/staff/dashboard';

      // Store'u session'dan önceden doldur — layout mount olduğunda user mevcut olur,
      // AuthProvider loading skeleton göstermez.
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const u = session.user;
          useAuthStore.getState().setUser({
            id: u.id,
            email: u.email ?? '',
            firstName: u.user_metadata?.first_name ?? '',
            lastName: u.user_metadata?.last_name ?? '',
            role: u.user_metadata?.role ?? 'staff',
            organizationId: u.user_metadata?.organization_id ?? null,
            tcNo: u.user_metadata?.tc_no ?? null,
            phone: u.user_metadata?.phone ?? null,
            departmentId: u.user_metadata?.department_id ?? null,
            department: u.user_metadata?.department ?? null,
            title: u.user_metadata?.title ?? null,
            avatarUrl: u.user_metadata?.avatar_url ?? null,
            isActive: u.user_metadata?.is_active !== false,
            kvkkConsent: u.user_metadata?.kvkk_consent ?? false,
            kvkkConsentDate: u.user_metadata?.kvkk_consent_date ?? null,
            createdAt: u.created_at,
            updatedAt: u.updated_at ?? u.created_at,
          });
        }
      });

      // Navigasyonu getSession'ı beklemeden hemen başlat
      router.push(target);
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel: Branding ── */}
      <div
        className="relative hidden lg:flex lg:w-[55%] flex-col justify-between overflow-hidden"
        style={{
          background: branding?.loginBannerUrl
            ? undefined
            : branding?.brandColor
              ? `linear-gradient(160deg, ${branding.brandColor} 0%, ${branding.brandColor}dd 35%, ${branding.brandColor}99 100%)`
              : 'linear-gradient(160deg, #064e3b 0%, #0a3d2e 35%, #051c14 100%)',
        }}
      >
        {/* Login banner (varsa tam ekran arka plan) */}
        {branding?.loginBannerUrl && (
          <div className="absolute inset-0 z-0">
            <Image src={branding.loginBannerUrl} alt="" fill className="object-cover" unoptimized />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          </div>
        )}

        {/* Particles */}
        <Particles className="absolute inset-0 z-0" quantity={80} staticity={20} color={branding?.secondaryColor || '#34d399'} size={0.3} />

        {/* Ripple center accent */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20">
          <Ripple mainCircleSize={300} mainCircleOpacity={0.1} numCircles={5} />
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(13, 150, 104, 0.15) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 z-0" style={{ background: 'linear-gradient(to top, rgba(5, 28, 20, 0.8), transparent)' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12 xl:p-16">
          {/* Logo */}
          <BlurFade delay={0.05} duration={0.3}>
            <div className="flex items-center gap-3">
              {branding?.logoUrl ? (
                <Image src={branding.logoUrl} alt={branding.name} width={44} height={44} className="rounded-2xl object-contain" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }} unoptimized />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold font-heading"
                  style={{ background: 'rgba(52, 211, 153, 0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399' }}
                >
                  H
                </div>
              )}
              <span className="text-xl font-bold text-white/90 font-heading tracking-tight">
                {branding?.name || 'Hastane LMS'}
              </span>
            </div>
          </BlurFade>

          {/* Hero text */}
          <div className="max-w-lg">
            <BlurFade delay={0.08} duration={0.3}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-6" style={{ color: '#34d399' }}>
                Personel Eğitim Platformu
              </p>
            </BlurFade>
            <BlurFade delay={0.1} duration={0.3}>
              <h1 className="text-[2.75rem] xl:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Eğitimi Yönet,<br />
                <span style={{ color: '#34d399' }}>Başarıyı Ölç.</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.12} duration={0.3}>
              <p className="text-base text-white/50 leading-relaxed max-w-md">
                Hastane personellerinize video tabanlı eğitimler atayın, sınav yapın ve performansı gerçek zamanlı takip edin.
              </p>
            </BlurFade>

            {/* Feature pills */}
            <div className="mt-10 space-y-3">
              {features.map((f, i) => (
                <BlurFade key={f.title} delay={0.15 + i * 0.05} duration={0.3}>
                  <div className="flex items-center gap-4 rounded-2xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(52, 211, 153, 0.1)' }}>
                      <f.icon className="h-5 w-5" style={{ color: '#34d399' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{f.title}</p>
                      <p className="text-xs text-white/40">{f.desc}</p>
                    </div>
                  </div>
                </BlurFade>
              ))}
            </div>
          </div>

          {/* Footer */}
          <BlurFade delay={0.2} duration={0.3}>
            <p className="text-xs text-white/30">&copy; 2026 {branding?.name || 'Hastane LMS Platformu'}</p>
          </BlurFade>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex flex-1 flex-col lg:items-center lg:justify-center" style={{ background: 'var(--color-bg)' }}>

        {/* ── MOBILE LAYOUT ── */}
        <div
          className="lg:hidden min-h-screen flex flex-col relative overflow-hidden"
          style={{ background: '#021a12' }}
        >
          {/* Full-screen ambient background */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 right-0 h-[55%]" style={{ background: 'linear-gradient(180deg, #064e3b 0%, #032b1f 100%)' }} />
            <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,150,104,0.15) 0%, transparent 65%)' }} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col min-h-screen px-6">

            {/* Header */}
            <div className="pt-12 pb-8">
              <div className="flex items-center gap-2.5">
                {branding?.logoUrl ? (
                  <Image src={branding.logoUrl} alt={branding.name} width={36} height={36} className="rounded-lg object-contain" style={{ background: 'rgba(255,255,255,0.1)' }} unoptimized />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #0d9668, #065f46)', color: 'white' }}>H</div>
                )}
                <div>
                  <span className="text-[15px] font-bold text-white block leading-tight">{branding?.name || 'Hastane LMS'}</span>
                  <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#34d399' }}>Eğitim Platformu</span>
                </div>
              </div>
            </div>

            {/* Hero text */}
            <div className="mb-8">
              <h1 className="text-[28px] font-extrabold text-white leading-[1.15] tracking-tight">
                Hoş Geldiniz
              </h1>
              <p className="text-[14px] mt-2 leading-relaxed" style={{ color: 'rgba(167, 211, 191, 0.7)' }}>
                Hesabınıza giriş yaparak eğitimlerinize devam edin
              </p>
            </div>

            {/* Form area — grows to fill */}
            <div className="flex-1 flex flex-col">
              {isTimeout && !error && (
                <div className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <Clock className="h-4 w-4 shrink-0" style={{ color: '#fbbf24' }} />
                  <span className="text-xs" style={{ color: '#fcd34d' }}>Oturumunuz zaman aşımına uğradı.</span>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#ef4444', color: 'white' }}>!</div>
                  <span className="text-xs" style={{ color: '#fca5a5' }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label className="text-[12px] font-medium mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>E-posta Adresi</Label>
                  <Input
                    type="email"
                    placeholder="ornek@hastane.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="h-13 rounded-2xl text-[15px] text-white placeholder:text-white/20"
                    style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Şifre</Label>
                    <Link href="/auth/forgot-password" className="text-[12px] font-medium" style={{ color: '#34d399' }}>Şifremi Unuttum</Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-13 rounded-2xl pr-12 text-[15px] text-white placeholder:text-white/20"
                      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="kvkk-mobile"
                      checked={kvkkAccepted}
                      onCheckedChange={(checked) => {
                        setKvkkAccepted(checked === true);
                        if (checked) setKvkkError(false);
                      }}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      style={kvkkError ? { borderColor: '#f87171' } : undefined}
                    />
                    <label htmlFor="kvkk-mobile" className="text-[12px] leading-relaxed cursor-pointer" style={{ color: kvkkError ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}>
                      <Link href="/kvkk" target="_blank" className="font-semibold underline" style={{ color: '#34d399' }}>KVKK Aydınlatma Metni</Link>&apos;ni okudum ve kabul ediyorum.
                    </label>
                  </div>
                  {kvkkError && <p className="text-[11px] font-medium pl-7" style={{ color: '#fca5a5' }}>KVKK metnini onaylamanız zorunludur.</p>}

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="rememberMe-mobile"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <label htmlFor="rememberMe-mobile" className="text-[12px] font-medium cursor-pointer select-none" style={{ color: 'rgba(255,255,255,0.4)' }}>Beni 30 gün hatırla</label>
                  </div>
                </div>

                <ShimmerButton
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 gap-2.5 text-[15px] font-semibold"
                  shimmerColor="rgba(255,255,255,0.15)"
                  shimmerSize="0.08em"
                  borderRadius="16px"
                  background={branding?.brandColor ? `linear-gradient(135deg, ${branding.brandColor} 0%, ${branding.brandColor}cc 100%)` : 'linear-gradient(135deg, #0d9668 0%, #065f46 100%)'}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                  {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
                </ShimmerButton>
              </form>

              {/* Bottom trust + copyright */}
              <div className="mt-auto pt-8 pb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Shield className="h-3.5 w-3.5" style={{ color: '#0d9668' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>KVKK Uyumlu &middot; 256-bit SSL &middot; Güvenli Bağlantı</span>
                </div>
                <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>&copy; 2026 Hastane LMS</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── DESKTOP LAYOUT (unchanged) ── */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-105">
          <div className="mb-10 flex items-center gap-3">
            {branding?.logoUrl ? (
              <Image src={branding.logoUrl} alt={branding.name} width={40} height={40} className="rounded-xl object-contain" unoptimized />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white font-heading" style={{ background: 'var(--color-primary)' }}>H</div>
            )}
            <span className="text-xl font-bold font-heading">{branding?.name || 'Hastane LMS'}</span>
          </div>

          <BlurFade delay={0.05} duration={0.3}>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--color-primary)' }}>
              Giriş Yap
            </p>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Hoş Geldiniz</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
              Devam etmek için hesabınıza giriş yapın
            </p>
          </BlurFade>

          {isTimeout && !error && (
            <BlurFade delay={0}>
              <div
                className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium"
                style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)' }}
              >
                <Clock className="h-5 w-5 shrink-0" />
                Uzun süre işlem yapmadığınız için oturumunuz sonlandırıldı.
              </div>
            </BlurFade>
          )}

          {error && (
            <BlurFade delay={0}>
              <div
                className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium"
                style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)' }}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--color-error)', color: 'white' }}>!</div>
                {error}
              </div>
            </BlurFade>
          )}

          <BlurFade delay={0.08} duration={0.3}>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>E-posta Adresi</Label>
                <Input
                  type="email"
                  placeholder="ornek@hastane.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-12 rounded-xl text-[15px]"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Şifre</Label>
                  <Link href="/auth/forgot-password" className="text-xs font-semibold transition-colors duration-150 hover:underline" style={{ color: 'var(--color-primary)' }}>Şifremi Unuttum</Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 rounded-xl pr-11 text-[15px]"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors duration-150"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="kvkk"
                    checked={kvkkAccepted}
                    onCheckedChange={(checked) => {
                      setKvkkAccepted(checked === true);
                      if (checked) setKvkkError(false);
                    }}
                    className="mt-0.5"
                    style={kvkkError ? { borderColor: 'var(--color-error)' } : undefined}
                  />
                  <label htmlFor="kvkk" className="text-xs leading-relaxed cursor-pointer" style={{ color: kvkkError ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>
                    <Link href="/kvkk" target="_blank" className="font-semibold underline transition-colors duration-150" style={{ color: 'var(--color-primary)' }}>
                      KVKK Aydınlatma Metni
                    </Link>
                    &apos;ni okudum ve kabul ediyorum.
                  </label>
                </div>
                {kvkkError && (
                  <p className="text-xs font-medium pl-6" style={{ color: 'var(--color-error)' }}>
                    Devam etmek için KVKK metnini onaylamanız zorunludur.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label htmlFor="rememberMe" className="text-xs font-medium cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
                  Beni 30 gün hatırla
                </label>
              </div>

              <ShimmerButton
                type="submit"
                disabled={loading}
                className="w-full h-12 gap-2.5 text-[15px] font-semibold"
                shimmerColor="rgba(255,255,255,0.15)"
                shimmerSize="0.08em"
                borderRadius="12px"
                background={branding?.brandColor ? `linear-gradient(135deg, ${branding.brandColor} 0%, ${branding.brandColor}cc 100%)` : 'linear-gradient(135deg, #0d9668 0%, #065f46 100%)'}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
              </ShimmerButton>
            </form>
          </BlurFade>

          <BlurFade delay={0.12} duration={0.3}>
            <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                &copy; 2026 Hastane LMS. Tüm hakları saklıdır.
              </p>
            </div>
          </BlurFade>
        </div>
        </div>
      {/* End right panel */}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
