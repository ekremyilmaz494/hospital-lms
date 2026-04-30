'use client';

import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Clock, ArrowRight, AlertCircle, ShieldCheck, GraduationCap, BarChart3, Award } from 'lucide-react';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import { BlurFade } from '@/components/ui/blur-fade';
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

/**
 * Login başarılı olduktan sonra hangi URL'e yönleneceğini hesaplar.
 *
 * Multi-tenant subdomain davranışı:
 * - super_admin (orgSlug=null) → apex'te kalır (relative path)
 * - admin/staff → https://<slug>.<base-domain><target>'a zıplar
 * - Zaten doğru subdomain'deyse relative path döner (gereksiz reload yok)
 * - Dev/localhost → relative path
 *
 * Cross-subdomain session paylaşımı `cookie-domain.ts`'teki domain attribute
 * sayesinde çalışır (Domain=.klinovax.com).
 */
function buildPostLoginUrl(targetPath: string, organizationSlug: string | null): string {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (!baseDomain || !organizationSlug) return targetPath;
  if (baseDomain.includes('localhost') || baseDomain.includes(':')) return targetPath;

  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    const expectedHost = `${organizationSlug}.${baseDomain}`;
    if (currentHost === expectedHost) return targetPath;
  }

  return `https://${organizationSlug}.${baseDomain}${targetPath}`;
}

// Klinova emerald palette
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

// Dark hero ink (admin warm-dark) — used for the left brand panel backdrop
const HERO_INK = '#1c1917';
const HERO_TEXT = '#fafaf9';
const HERO_TEXT_SOFT = 'rgba(250, 250, 249, 0.66)';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirectTo');
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const isTimeout = searchParams.get('reason') === 'timeout';
  const urlReason = searchParams.get('reason');
  const urlMsg = searchParams.get('msg');
  const initialError = urlReason === 'kvkk-rejected' && urlMsg ? urlMsg : '';

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [webglSupported, setWebglSupported] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = document.createElement('canvas');
      const hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      setWebglSupported(hasWebGL);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
      const targetPath = isRedirectCompatible ? redirectTo : (role && ROLE_ROUTES[role]) || '/staff/dashboard';
      // super_admin için organizationSlug null → apex'te kalır
      const target = buildPostLoginUrl(targetPath, data.organizationSlug ?? null);

      // Setup wizard guard cache'ini önceden doldur — admin layout aynı anahtarı
      // okuyup /api/admin/setup fetch'ini atlar (ilk login'de 1 round-trip kazanç).
      if (role === 'admin' && data.user?.id && data.setupCompleted === true) {
        try {
          sessionStorage.setItem(`admin-setup-completed:${data.user.id}`, '1');
        } catch {}
      }

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


  return (
    <div className="flex h-screen overflow-hidden" style={{ background: K.BG }}>
      <style>{`
        .ed-display { font-family: ${K.FONT_DISPLAY}; font-weight: 700; }
        .ed-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        .ed-input {
          width: 100%;
          height: 50px;
          padding: 0 16px;
          background: ${K.SURFACE};
          border: 1.5px solid ${K.BORDER};
          border-radius: 12px;
          font-size: 15px;
          color: ${K.TEXT_PRIMARY};
          transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
          outline: none;
        }
        .ed-input:focus { border-color: ${K.PRIMARY}; background: ${K.SURFACE}; box-shadow: 0 0 0 3px ${K.PRIMARY_LIGHT}; }
        .ed-input::placeholder { color: ${K.TEXT_MUTED}; opacity: 0.7; }
        .ed-checkbox {
          appearance: none;
          width: 14px; height: 14px;
          border: 1.5px solid ${K.BORDER};
          background: ${K.SURFACE};
          cursor: pointer;
          position: relative;
          flex-shrink: 0;
          border-radius: 3px;
          transition: background-color 160ms ease, border-color 160ms ease;
        }
        .ed-checkbox:checked { background: ${K.PRIMARY}; border-color: ${K.PRIMARY}; }
        .ed-checkbox:checked::after {
          content: ""; position: absolute;
          top: 50%; left: 50%;
          width: 3px; height: 6px;
          border: solid #ffffff;
          border-width: 0 1.5px 1.5px 0;
          transform: translate(-50%, -60%) rotate(45deg);
        }
        @keyframes ed-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        .ed-pulse { animation: ed-glow 6s ease-in-out infinite; }
      `}</style>

      {/* ── LEFT — Aurora Hero (warm-dark + emerald, admin-aligned) ── */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #1c1917 0%, #292524 55%, #1c1917 100%)' }}
      >
        {branding?.loginBannerUrl && (
          <div className="absolute inset-0 z-0">
            <Image src={branding.loginBannerUrl} alt="" fill className="object-cover" unoptimized />
            <div className="absolute inset-0" style={{ background: 'rgba(28, 25, 23, 0.85)' }} />
          </div>
        )}

        {/* Aurora animation — emerald monochrome on warm-dark */}
        <style>{`
          @keyframes aurora-drift-1 {
            0% { transform: translate(-10%, -10%) rotate(0deg); }
            50% { transform: translate(10%, 5%) rotate(180deg); }
            100% { transform: translate(-10%, -10%) rotate(360deg); }
          }
          @keyframes aurora-drift-2 {
            0% { transform: translate(10%, 10%) rotate(0deg); }
            50% { transform: translate(-10%, -5%) rotate(-180deg); }
            100% { transform: translate(10%, 10%) rotate(-360deg); }
          }
          @keyframes aurora-pulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 0.75; }
          }
          .aurora-1 {
            position: absolute; top: -20%; left: -20%;
            width: 80%; height: 80%; border-radius: 9999px;
            background: radial-gradient(circle, #0d9668 0%, transparent 65%);
            filter: blur(60px);
            animation: aurora-drift-1 28s ease-in-out infinite, aurora-pulse 8s ease-in-out infinite;
          }
          .aurora-2 {
            position: absolute; bottom: -25%; right: -20%;
            width: 85%; height: 85%; border-radius: 9999px;
            background: radial-gradient(circle, #087a54 0%, transparent 65%);
            filter: blur(70px);
            animation: aurora-drift-2 32s ease-in-out infinite, aurora-pulse 10s ease-in-out infinite;
          }
          .aurora-3 {
            position: absolute; top: 30%; left: 30%;
            width: 50%; height: 50%; border-radius: 9999px;
            background: radial-gradient(circle, #10b98166 0%, transparent 70%);
            filter: blur(50px);
            animation: aurora-drift-1 22s ease-in-out infinite reverse;
          }
        `}</style>
        <div className="aurora-1 z-0" />
        <div className="aurora-2 z-0" />
        <div className="aurora-3 z-0" />


        {/* CONTENT */}
        <div className="relative z-10 flex h-full flex-col p-12 xl:p-16">

          {/* TOP — vibrant brand mark */}
          <BlurFade delay={0.04} duration={0.3}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #087a54 100%)',
                  borderRadius: 12,
                  boxShadow: '0 8px 28px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-editorial), Georgia, serif",
                    fontStyle: 'italic', fontWeight: 700, fontSize: 24,
                    color: '#ffffff', lineHeight: 1, transform: 'translateY(1px)',
                  }}
                >
                  K
                </span>
              </div>
              <div className="flex flex-col">
                <span
                  style={{
                    fontFamily: "var(--font-editorial), Georgia, serif",
                    fontStyle: 'italic', fontWeight: 500, fontSize: 26,
                    color: '#ffffff', lineHeight: 1, letterSpacing: '-0.01em',
                  }}
                >
                  Klinova
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                    fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.28em',
                    background: 'linear-gradient(90deg, #6ee7b7, #a7f3d0)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text', marginTop: 3, textTransform: 'uppercase',
                  }}
                >
                  Hospital Suite
                </span>
              </div>
            </div>
          </BlurFade>

          {/* MIDDLE — vibrant hero */}
          <div className="flex flex-1 flex-col justify-center py-10">

            <BlurFade delay={0.06} duration={0.28}>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 self-start"
                style={{
                  background: 'rgba(255, 255, 255, 0.10)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: 9999,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '9999px', background: '#34d399', boxShadow: '0 0 12px #34d399' }} />
                <span
                  style={{
                    fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                    fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.22em',
                    background: 'linear-gradient(90deg, #6ee7b7, #a7f3d0)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text', textTransform: 'uppercase',
                  }}
                >
                  Yeni Nesil Klinik LMS
                </span>
              </div>
            </BlurFade>

            <BlurFade delay={0.08} duration={0.3}>
              <h1
                className="leading-[1] tracking-tight"
                style={{
                  color: '#ffffff',
                  fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                  fontSize: 'clamp(2.6rem, 4.4vw, 4rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                }}
              >
                Hastane eğitimini
                <br />
                <span
                  style={{
                    background: 'linear-gradient(110deg, #6ee7b7 0%, #34d399 40%, #34d399 75%, #a7f3d0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontStyle: 'italic',
                    fontFamily: "var(--font-editorial), Georgia, serif",
                    fontWeight: 600,
                  }}
                >
                  yeniden tanımla.
                </span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.10} duration={0.28}>
              <p
                className="mt-6 max-w-md text-[15.5px] leading-[1.65]"
                style={{
                  color: 'rgba(241, 245, 249, 0.78)',
                  fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                }}
              >
                Video tabanlı eğitim, otomatik sınav, sertifikasyon ve gerçek zamanlı performans
                takibi — hepsi tek bir parlak panelde.
              </p>
            </BlurFade>

            {/* Vibrant feature cards (3-up) */}
            <BlurFade delay={0.13} duration={0.3}>
              <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { icon: GraduationCap, label: 'Video Eğitim' },
                  { icon: Award, label: 'Sertifika' },
                  { icon: BarChart3, label: 'Analitik' },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="flex flex-col items-start p-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      borderRadius: 14,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center mb-3"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #087a54)',
                        borderRadius: 10,
                        boxShadow: '0 8px 18px rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      <c.icon size={16} style={{ color: '#ffffff' }} />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                        fontSize: 12.5, fontWeight: 600, color: '#ffffff',
                      }}
                    >
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </BlurFade>

            {/* Glowing stat strip */}
            <BlurFade delay={0.16} duration={0.3}>
              <div
                className="mt-12 flex items-stretch gap-px overflow-hidden max-w-md"
                style={{
                  background: 'linear-gradient(90deg, #10b98166, #0d966866)',
                  borderRadius: 14,
                  padding: 1,
                }}
              >
                <div
                  className="flex w-full"
                  style={{
                    background: 'rgba(15, 23, 42, 0.55)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 13,
                  }}
                >
                  {[
                    { value: '120+', label: 'HASTANE', accent: '#34d399' },
                    { value: '50K+', label: 'PERSONEL', accent: '#34d399' },
                    { value: '99.9%', label: 'UPTIME', accent: '#a7f3d0' },
                  ].map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <span style={{ width: 1, background: 'rgba(255,255,255,0.12)' }} />}
                      <div className="flex flex-1 flex-col items-start px-5 py-4">
                        <span
                          style={{
                            fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                            fontSize: 24, fontWeight: 800,
                            background: `linear-gradient(135deg, ${s.accent}, #ffffff)`,
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            letterSpacing: '-0.02em', lineHeight: 1.1,
                          }}
                        >
                          {s.value}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                            fontSize: 9.5, fontWeight: 600,
                            letterSpacing: '0.22em',
                            color: 'rgba(241, 245, 249, 0.65)',
                            marginTop: 6,
                          }}
                        >
                          {s.label}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </BlurFade>
          </div>

          {/* BOTTOM — KVKK badge + footer */}
          <BlurFade delay={0.18} duration={0.28}>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  background: 'rgba(52, 211, 153, 0.16)',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  borderRadius: 9999,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <ShieldCheck size={13} style={{ color: '#6ee7b7' }} />
                <span style={{ fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)", fontSize: 11.5, fontWeight: 600, color: '#a7f3d0' }}>
                  KVKK Uyumlu · ISO 27001
                </span>
              </span>
            </div>
            <div
              className="flex items-center justify-between"
              style={{
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', system-ui)",
                fontSize: 11, fontWeight: 500,
                letterSpacing: '0.2em',
                color: 'rgba(241, 245, 249, 0.5)',
                textTransform: 'uppercase',
              }}
            >
              <span>© 2026 Klinova</span>
              <span
                style={{
                  background: 'linear-gradient(90deg, #6ee7b7, #a7f3d0)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Hospital LMS · v2.0
              </span>
            </div>
          </BlurFade>
        </div>
      </aside>

      {/* ── RIGHT — Cream Form Panel ── */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-10" style={{ background: K.BG }}>
        {/* MeshGradient shader — animated emerald/sage ambient backdrop */}
        <div className="absolute inset-0 z-0">
          {webglSupported ? (
            <MeshGradient
              style={{ width: '100%', height: '100%' }}
              colors={[K.BG, '#a7f3d0', '#34d399', K.PRIMARY, '#0a5d40', '#6ee7b7']}
              distortion={1.1}
              swirl={0.55}
              speed={0.35}
              offsetX={0.05}
              grainMixer={0}
              grainOverlay={0}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  `radial-gradient(circle at 18% 18%, ${K.PRIMARY}88, transparent 38%), radial-gradient(circle at 78% 24%, #34d399cc, transparent 40%), linear-gradient(135deg, ${K.BG} 0%, #a7f3d0 52%, ${K.BG} 100%)`,
              }}
            />
          )}
          {/* Very light cream veil — softens edges only, keeps gradient visible */}
          <div className="absolute inset-0" style={{ background: 'rgba(250, 250, 249, 0.08)' }} />
          {/* Cream dot texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              backgroundImage: `radial-gradient(circle, ${K.BORDER_LIGHT} 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[440px]">
          {/* Form card */}
          <div
            className="relative"
            style={{
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 16,
              padding: '36px 38px',
              boxShadow: K.SHADOW_CARD,
            }}
          >
            <BlurFade delay={0.04} duration={0.25}>
              <div className="ed-mono text-[10px] tracking-[0.32em]" style={{ color: K.PRIMARY }}>
                № 02 · OTURUM AÇ
              </div>
            </BlurFade>

            <BlurFade delay={0.06} duration={0.25}>
              <h2
                className="ed-display mt-3 leading-[1.05] tracking-tight"
                style={{ color: K.TEXT_PRIMARY, fontSize: '2rem', fontWeight: 700 }}
              >
                Hoş <span style={{ fontStyle: 'italic', color: K.PRIMARY }}>geldiniz.</span>
              </h2>
            </BlurFade>

            <BlurFade delay={0.08} duration={0.25}>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: K.TEXT_SECONDARY }}>
                Devam etmek için kurum hesabınızla giriş yapın.
              </p>
            </BlurFade>

            <BlurFade delay={0.10} duration={0.25}>
              <div className="my-6 h-px" style={{ background: K.BORDER_LIGHT }} />
            </BlurFade>

            {isTimeout && !error && (
              <BlurFade delay={0}>
                <div
                  className="mb-5 flex items-start gap-3 px-4 py-3 text-[13px]"
                  style={{ background: K.WARNING_BG, color: '#92400e', borderLeft: `3px solid ${K.WARNING}`, borderRadius: 8 }}
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
                  style={{ background: K.ERROR_BG, color: '#b91c1c', borderLeft: `3px solid ${K.ERROR}`, borderRadius: 8 }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#b91c1c' }} />
                  <span>{error}</span>
                </div>
              </BlurFade>
            )}

            <BlurFade delay={0.12} duration={0.25}>
              <form
                onSubmit={handleLogin}
                className="space-y-4"
                data-testid="login-form"
                data-hydrated={hydrated ? 'true' : 'false'}
              >
                {/* Email */}
                <div>
                  <label className="ed-mono text-[10px] tracking-[0.28em] mb-2 block" style={{ color: K.TEXT_PRIMARY }}>
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
                    <label className="ed-mono text-[10px] tracking-[0.28em]" style={{ color: K.TEXT_PRIMARY }}>
                      ŞİFRE
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="ed-mono text-[10px] tracking-[0.2em] transition-colors hover:underline"
                      style={{ color: K.PRIMARY }}
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
                      style={{ color: K.TEXT_MUTED }}
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
                  <span className="text-[13px]" style={{ color: K.TEXT_SECONDARY }}>
                    Bu cihazda oturumumu açık tut <span style={{ opacity: 0.7 }}>(7 gün)</span>
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="login-submit"
                  className="group relative w-full mt-2 flex items-center justify-center gap-3 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    height: 52,
                    background: K.PRIMARY,
                    color: '#ffffff',
                    border: `1.5px solid ${K.PRIMARY}`,
                    borderRadius: 12,
                    boxShadow: `0 4px 12px ${K.PRIMARY}33`,
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.background = K.PRIMARY_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.currentTarget.style.background = K.PRIMARY;
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#ffffff' }} />
                      <span className="ed-mono text-[12px] tracking-[0.28em]">GİRİŞ YAPILIYOR…</span>
                    </>
                  ) : (
                    <>
                      <span className="ed-mono text-[12px] tracking-[0.28em]">OTURUM AÇ</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" style={{ color: '#ffffff' }} />
                    </>
                  )}
                </button>

                {/* KVKK */}
                <p className="text-[11.5px] leading-snug pt-1" style={{ color: K.TEXT_MUTED }}>
                  Giriş yaparak{' '}
                  <Link href="/kvkk" target="_blank" className="underline underline-offset-2" style={{ color: K.PRIMARY }}>
                    KVKK Aydınlatma Metni
                  </Link>
                  &apos;ni okumuş ve bilgilendirilmiş kabul edersiniz.
                </p>
              </form>
            </BlurFade>
          </div>

          {/* Mobile footer */}
          <BlurFade delay={0.14} duration={0.25}>
            <div className="mt-6 flex items-center justify-between ed-mono text-[10px] tracking-[0.25em] lg:hidden" style={{ color: K.TEXT_MUTED }}>
              <span>© 2026</span>
              <span style={{ color: K.PRIMARY }}>HOSPITAL LMS</span>
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
