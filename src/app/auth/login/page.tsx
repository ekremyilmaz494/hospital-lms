'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Clock, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import { BlurFade } from '@/components/ui/blur-fade';
import { KlinovaMark } from '@/components/ui/klinova-mark';
import { KvkkNoticeModal } from '@/components/shared/kvkk-notice-modal';

const Particles = dynamic(() => import('@/components/ui/particles').then(m => ({ default: m.Particles })), { ssr: false });
// MeshGradient is WebGL — must be client-only
const MeshGradient = dynamic(
  () => import('@paper-design/shaders-react').then(m => ({ default: m.MeshGradient })),
  { ssr: false }
);

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useOrgBranding } from '@/hooks/use-org-branding';
import { getRolePath } from '@/lib/route-helpers';

const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  admin: '/admin/dashboard',
  staff: '/staff/dashboard',
};

// Clinical Editorial palette
const INK = '#0a1628';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const AMBER = '#f59e0b';
const INK_SOFT = '#5b6478';
const CREAM_SOFT = 'rgba(245, 241, 232, 0.62)';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  const rawRedirect = searchParams.get('redirectTo');
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const isTimeout = searchParams.get('reason') === 'timeout';
  const urlReason = searchParams.get('reason');
  const urlMsg = searchParams.get('msg');

  useEffect(() => {
    if (urlReason === 'kvkk-rejected' && urlMsg) setError(urlMsg);
  }, [urlReason, urlMsg]);

  // KVKK onayı zorunlu: middleware authenticated ama onaysız kullanıcıyı
  // buraya yönlendirdiğinde modalı otomatik aç. Refresh bypass'ının client ayağı.
  useEffect(() => {
    if (urlReason !== 'kvkk-required') return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;

        const r = (session.user.app_metadata?.role ?? session.user.user_metadata?.role) as string | undefined;
        const target = ROLE_ROUTES[r ?? 'staff'] ?? '/staff/dashboard';

        // Başka sekmede onaylandıysa direkt dashboard'a çık
        if (session.user.user_metadata?.kvkk_notice_acknowledged_at) {
          window.location.href = target;
          return;
        }

        setPendingRedirect(target);
      } catch {
        // Session okunamadı — form olduğu gibi kalır
      }
    })();
    return () => { cancelled = true; };
  }, [urlReason]);

  const orgSlug = searchParams.get('org');
  const { branding } = useOrgBranding(orgSlug);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });
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

      if (data.mfaRequired) {
        router.push(`/auth/mfa-verify?factorId=${encodeURIComponent(data.factorId)}`);
        return;
      }

      if (data.smsMfaRequired) {
        router.push(data.phoneMissing ? '/auth/phone-setup' : '/auth/sms-verify');
        return;
      }

      if (data.mustChangePassword) {
        router.push('/auth/change-password?reason=first-login');
        return;
      }

      const role = data.user?.role as string | undefined;
      const rolePrefix = getRolePath(role, 'dashboard');
      const isRedirectCompatible = redirectTo && redirectTo !== '/' && redirectTo.startsWith(rolePrefix);
      const target = isRedirectCompatible ? redirectTo : (role && ROLE_ROUTES[role]) || '/staff/dashboard';

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = session.user;
        useAuthStore.getState().setUser({
          id: u.id,
          email: u.email ?? '',
          firstName: u.user_metadata?.first_name ?? '',
          lastName: u.user_metadata?.last_name ?? '',
          role: u.app_metadata?.role ?? u.user_metadata?.role ?? 'staff',
          organizationId: u.app_metadata?.organization_id ?? u.user_metadata?.organization_id ?? null,
          phone: u.user_metadata?.phone ?? null,
          departmentId: u.user_metadata?.department_id ?? null,
          department: u.user_metadata?.department ?? null,
          title: u.user_metadata?.title ?? null,
          avatarUrl: u.user_metadata?.avatar_url ?? null,
          isActive: u.user_metadata?.is_active !== false,
          kvkkNoticeAcknowledgedAt: u.user_metadata?.kvkk_notice_acknowledged_at ?? null,
          createdAt: u.created_at,
          updatedAt: u.updated_at ?? u.created_at,
        });
      }

      const kvkkAcknowledged = session?.user?.user_metadata?.kvkk_notice_acknowledged_at ?? null;
      if (!kvkkAcknowledged) {
        setPendingRedirect(target);
        setLoading(false);
        return;
      }

      window.location.href = target;
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setLoading(false);
    }
  };

  if (pendingRedirect) {
    return (
      <KvkkNoticeModal
        onAcknowledge={() => { window.location.href = pendingRedirect; }}
        onReject={async () => {
          try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
          try {
            const supabase = createClient();
            await supabase.auth.signOut();
          } catch {}
          useAuthStore.getState().logout();
          const msg = encodeURIComponent('Sisteme giriş için KVKK Aydınlatma Metni\'ni onaylamanız gerekmektedir.');
          window.location.href = `/auth/login?reason=kvkk-rejected&msg=${msg}`;
        }}
      />
    );
  }

  const tenantName = branding?.name || 'Devakent Hastanesi';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: CREAM }}>
      <style>{`
        .ed-display { font-family: var(--font-plus-jakarta-sans), serif; }
        .ed-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .ed-input {
          width: 100%;
          height: 50px;
          padding: 0 16px;
          background: ${CREAM};
          border: 1.5px solid ${RULE};
          border-radius: 0;
          font-size: 15px;
          color: ${INK};
          transition: border-color 180ms ease, background-color 180ms ease;
          outline: none;
        }
        .ed-input:focus { border-color: ${INK}; background: #fff; }
        .ed-input::placeholder { color: ${INK_SOFT}; opacity: 0.6; }
        .ed-checkbox {
          appearance: none;
          width: 12px; height: 12px;
          border: 1px solid ${RULE};
          background: ${CREAM};
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
        }
        .ed-checkbox:checked { background: ${INK}; border-color: ${INK}; }
        .ed-checkbox:checked::after {
          content: ""; position: absolute;
          top: 50%; left: 50%;
          width: 3px; height: 6px;
          border: solid ${GOLD};
          border-width: 0 1.5px 1.5px 0;
          transform: translate(-50%, -60%) rotate(45deg);
        }
        @keyframes ed-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        .ed-pulse { animation: ed-glow 6s ease-in-out infinite; }
      `}</style>

      {/* ── LEFT — Dark Editorial Brand Panel ── */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden"
        style={{ background: INK }}
      >
        {/* Backdrop layers */}
        {branding?.loginBannerUrl && (
          <div className="absolute inset-0 z-0">
            <Image src={branding.loginBannerUrl} alt="" fill className="object-cover" unoptimized />
            <div className="absolute inset-0" style={{ background: 'rgba(10, 22, 40, 0.85)' }} />
          </div>
        )}
        <div
          className="absolute inset-0 z-0 ed-pulse"
          style={{ background: `radial-gradient(ellipse 65% 55% at 50% 50%, ${GOLD}1f 0%, transparent 60%)` }}
        />
        <div
          className="absolute inset-0 z-0 opacity-[0.16]"
          style={{
            backgroundImage: `radial-gradient(circle, ${GOLD} 1px, transparent 1px)`,
            backgroundSize: '26px 26px',
          }}
        />
        <Particles className="absolute inset-0 z-0" quantity={50} staticity={50} color={GOLD} size={0.4} />

        {/* CONTENT — symmetric padding, vertical 3-zone layout */}
        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">

          {/* TOP — tenant masthead */}
          <BlurFade delay={0.05} duration={0.4}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {branding?.logoUrl ? (
                  <Image
                    src={branding.logoUrl}
                    alt={tenantName}
                    width={38}
                    height={38}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center ed-display text-lg font-semibold"
                    style={{ color: GOLD, border: `1.5px solid ${GOLD}` }}
                  >
                    H
                  </div>
                )}
                <span className="ed-display text-lg font-semibold tracking-tight" style={{ color: '#f5f1e8' }}>
                  {tenantName}
                </span>
              </div>
              <span className="ed-mono text-[10px] tracking-[0.28em]" style={{ color: GOLD }}>
                EST · 2026
              </span>
            </div>
          </BlurFade>

          {/* CENTER — brand mark + hero — auto-centered via flex-1 */}
          <div className="flex flex-1 flex-col justify-center py-10">
            <BlurFade delay={0.1} duration={0.4}>
              <div className="mb-2">
                <KlinovaMark
                  width={420}
                  height={92}
                  strokeWidth={6}
                  animationDuration={2.8}
                  baseColor={GOLD}
                  gradientColors={[`${GOLD}00`, AMBER, `${GOLD}00`]}
                  labelColor={GOLD}
                />
              </div>
            </BlurFade>

            <BlurFade delay={0.18} duration={0.4}>
              <div className="ed-mono text-[11px] tracking-[0.32em]" style={{ color: GOLD }}>
                № 01 · KLİNİK EĞİTİM MECRASI
              </div>
            </BlurFade>

            <BlurFade delay={0.22} duration={0.4}>
              <h1
                className="ed-display mt-6 leading-[0.98] tracking-tight"
                style={{ color: '#f8f4ea', fontSize: 'clamp(2.4rem, 4vw, 3.6rem)', fontWeight: 600 }}
              >
                Eğitimi yönet,
                <br />
                <span style={{ fontStyle: 'italic', color: GOLD }}>başarıyı ölç.</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.26} duration={0.4}>
              <p className="mt-5 max-w-md text-[14.5px] leading-[1.65]" style={{ color: CREAM_SOFT }}>
                Hastane personellerinize video tabanlı eğitimler atayın, sınav yapın ve performansı
                gerçek zamanlı takip edin.
              </p>
            </BlurFade>
          </div>

          {/* BOTTOM — footer */}
          <BlurFade delay={0.35} duration={0.4}>
            <div className="h-px w-full" style={{ background: `${GOLD}33` }} />
            <div className="mt-4 flex items-center justify-between ed-mono text-[10px] tracking-[0.25em]" style={{ color: 'rgba(245,241,232,0.4)' }}>
              <span>© 2026 · {tenantName.toUpperCase()}</span>
              <span style={{ color: GOLD }}>HOSPITAL LMS</span>
            </div>
          </BlurFade>
        </div>
      </aside>

      {/* ── RIGHT — Cream Form Panel ── */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-10" style={{ background: CREAM }}>
        {/* MeshGradient shader — animated cream/gold/sage ambient backdrop */}
        <div className="absolute inset-0 z-0">
          <MeshGradient
            style={{ width: '100%', height: '100%' }}
            colors={['#faf7f2', '#f3dfa6', '#d4a437', '#c9a961', '#A9C4B3', '#e7c97a']}
            distortion={1.1}
            swirl={0.55}
            speed={0.35}
            offsetX={0.05}
            grainMixer={0}
            grainOverlay={0}
          />
          {/* Very light cream veil — softens edges only, keeps gradient visible */}
          <div className="absolute inset-0" style={{ background: 'rgba(250, 247, 242, 0.12)' }} />
          {/* Cream dot texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage: `radial-gradient(circle, ${RULE} 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[440px]">
          {/* Mobile masthead */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            {branding?.logoUrl ? (
              <Image src={branding.logoUrl} alt={tenantName} width={36} height={36} className="object-contain" unoptimized />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center ed-display text-base font-semibold"
                style={{ background: INK, color: GOLD }}
              >
                H
              </div>
            )}
            <span className="ed-display text-lg font-semibold" style={{ color: INK }}>
              {tenantName}
            </span>
          </div>

          {/* Form card with gold left rail */}
          <div
            className="relative bg-white"
            style={{
              border: `1.5px solid ${RULE}`,
              borderLeft: `6px solid ${GOLD}`,
              padding: '36px 38px',
            }}
          >
            <BlurFade delay={0.08} duration={0.4}>
              <div className="ed-mono text-[10px] tracking-[0.32em]" style={{ color: GOLD }}>
                № 02 · OTURUM AÇ
              </div>
            </BlurFade>

            <BlurFade delay={0.12} duration={0.4}>
              <h2
                className="ed-display mt-3 leading-[1.05] tracking-tight"
                style={{ color: INK, fontSize: '2rem', fontWeight: 600 }}
              >
                Hoş <span style={{ fontStyle: 'italic', color: GOLD }}>geldiniz.</span>
              </h2>
            </BlurFade>

            <BlurFade delay={0.16} duration={0.4}>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                Devam etmek için kurum hesabınızla giriş yapın.
              </p>
            </BlurFade>

            <BlurFade delay={0.18} duration={0.4}>
              <div className="my-6 h-px" style={{ background: RULE }} />
            </BlurFade>

            {isTimeout && !error && (
              <BlurFade delay={0}>
                <div
                  className="mb-5 flex items-start gap-3 px-4 py-3 text-[13px]"
                  style={{ background: '#fdf6e3', color: '#7a5511', borderLeft: `3px solid ${GOLD}` }}
                >
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Uzun süre işlem yapmadığınız için oturumunuz sonlandırıldı.</span>
                </div>
              </BlurFade>
            )}

            {error && (
              <BlurFade delay={0}>
                <div
                  className="mb-5 flex items-start gap-3 px-4 py-3 text-[13px]"
                  style={{ background: '#fdf2ee', color: '#992f1d', borderLeft: '3px solid #b3261e' }}
                >
                  <span className="ed-mono text-[11px] mt-0.5" style={{ color: '#b3261e' }}>!</span>
                  <span>{error}</span>
                </div>
              </BlurFade>
            )}

            <BlurFade delay={0.22} duration={0.4}>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="ed-mono text-[10px] tracking-[0.28em] mb-2 block" style={{ color: INK }}>
                    E-POSTA
                  </label>
                  <Input
                    type="email"
                    placeholder="ornek@hastane.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="ed-input"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="ed-mono text-[10px] tracking-[0.28em]" style={{ color: INK }}>
                      ŞİFRE
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="ed-mono text-[10px] tracking-[0.2em] transition-colors hover:underline"
                      style={{ color: GOLD }}
                    >
                      UNUTTUM ↗
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="ed-input"
                      style={{ paddingRight: 48 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 transition-colors"
                      style={{ color: INK_SOFT }}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    className="ed-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="text-[13px]" style={{ color: INK_SOFT }}>
                    Bu cihazda oturumumu açık tut <span style={{ opacity: 0.7 }}>(7 gün)</span>
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full mt-2 flex items-center justify-center gap-3 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    height: 52,
                    background: INK,
                    color: '#f8f4ea',
                    border: `1.5px solid ${INK}`,
                    boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 3px #fff, 0 0 0 4px ${GOLD}55`,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
                      <span className="ed-mono text-[12px] tracking-[0.28em]">GİRİŞ YAPILIYOR…</span>
                    </>
                  ) : (
                    <>
                      <span className="ed-mono text-[12px] tracking-[0.28em]">OTURUM AÇ</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" style={{ color: GOLD }} />
                    </>
                  )}
                </button>

                {/* KVKK */}
                <p className="text-[11.5px] leading-snug pt-1" style={{ color: INK_SOFT }}>
                  Giriş yaparak{' '}
                  <Link href="/kvkk" target="_blank" className="underline underline-offset-2" style={{ color: INK }}>
                    KVKK Aydınlatma Metni
                  </Link>
                  &apos;ni okumuş ve bilgilendirilmiş kabul edersiniz.
                </p>
              </form>
            </BlurFade>
          </div>

          {/* Mobile footer */}
          <BlurFade delay={0.3} duration={0.4}>
            <div className="mt-6 flex items-center justify-between ed-mono text-[10px] tracking-[0.25em] lg:hidden" style={{ color: INK_SOFT }}>
              <span>© 2026 · {tenantName.toUpperCase()}</span>
              <span style={{ color: GOLD }}>HOSPITAL LMS</span>
            </div>
          </BlurFade>
        </div>
      </main>
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
