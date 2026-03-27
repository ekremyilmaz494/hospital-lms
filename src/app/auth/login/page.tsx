'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn, Loader2, Shield, BookOpen, BarChart3, ChevronRight, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { Particles } from '@/components/ui/particles';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Ripple } from '@/components/ui/ripple';
import { BorderBeam } from '@/components/ui/border-beam';

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

  const rawRedirect = searchParams.get('redirectTo');
  // Prevent open redirect — only allow relative paths starting with /
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const isTimeout = searchParams.get('reason') === 'timeout';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('E-posta veya şifre hatalı.');
        setLoading(false);
        return;
      }

      const role = data.user?.user_metadata?.role as string;
      const target = redirectTo && redirectTo !== '/' ? redirectTo : ROLE_ROUTES[role] || '/staff/dashboard';
      router.push(target);
      router.refresh();
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
        style={{ background: 'linear-gradient(160deg, #064e3b 0%, #0a3d2e 35%, #051c14 100%)' }}
      >
        {/* Particles */}
        <Particles className="absolute inset-0 z-0" quantity={80} staticity={20} color="#34d399" size={0.3} />

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
          <BlurFade delay={0.1}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold font-heading"
                style={{ background: 'rgba(52, 211, 153, 0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(52, 211, 153, 0.2)', color: '#34d399' }}
              >
                H
              </div>
              <span className="text-xl font-bold text-white/90 font-heading tracking-tight">Hastane LMS</span>
            </div>
          </BlurFade>

          {/* Hero text */}
          <div className="max-w-lg">
            <BlurFade delay={0.2}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-6" style={{ color: '#34d399' }}>
                Personel Eğitim Platformu
              </p>
            </BlurFade>
            <BlurFade delay={0.3}>
              <h1 className="text-[2.75rem] xl:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Eğitimi Yönet,<br />
                <span style={{ color: '#34d399' }}>Başarıyı Ölç.</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.4}>
              <p className="text-base text-white/50 leading-relaxed max-w-md">
                Hastane personellerinize video tabanlı eğitimler atayın, sınav yapın ve performansı gerçek zamanlı takip edin.
              </p>
            </BlurFade>

            {/* Feature pills */}
            <div className="mt-10 space-y-3">
              {features.map((f, i) => (
                <BlurFade key={f.title} delay={0.5 + i * 0.1}>
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
          <BlurFade delay={0.8}>
            <p className="text-xs text-white/30">&copy; 2026 Hastane LMS Platformu</p>
          </BlurFade>
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8" style={{ background: 'var(--color-bg)' }}>
        <div className="w-full max-w-105">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white font-heading" style={{ background: 'var(--color-primary)' }}>H</div>
            <span className="text-xl font-bold font-heading">Hastane LMS</span>
          </div>

          <BlurFade delay={0.1}>
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

          <BlurFade delay={0.2}>
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

              <ShimmerButton
                type="submit"
                disabled={loading}
                className="w-full h-12 gap-2.5 text-[15px] font-semibold"
                shimmerColor="rgba(255,255,255,0.15)"
                shimmerSize="0.08em"
                borderRadius="12px"
                background="linear-gradient(135deg, #0d9668 0%, #065f46 100%)"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                {!loading && <ChevronRight className="h-4 w-4 ml-1 opacity-60" />}
              </ShimmerButton>
            </form>
          </BlurFade>

          <BlurFade delay={0.4}>
            <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                &copy; 2026 Hastane LMS. Tüm hakları saklıdır.
              </p>
            </div>
          </BlurFade>
        </div>
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
