'use client';

import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, Clock, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BlurFade } from '@/components/ui/blur-fade';
import { KvkkNoticeModal } from '@/components/shared/kvkk-notice-modal';
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc';
import LoginBrandPanel from '@/components/login/LoginBrandPanel';
import LoginFormDecorations from '@/components/login/LoginFormDecorations';
import { createClient } from '@/lib/supabase/client';
import { BRAND } from '@/lib/brand';
import { useAuthStore } from '@/store/auth-store';
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

// Landing-3d sıcak editöryel palet — tokens.css --landing-* ile hizalı.
// (Eski stone/emerald palet warm cream/olive/amber'a repoint edildi; tüm
//  style={{ color: K.x }} referansları otomatik olarak landing temasına geçer.)
const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#f5f0e6', SURFACE_HOVER: '#efe8da', BG: '#fafaf9',
  BORDER: 'rgba(26, 58, 40, 0.16)', BORDER_LIGHT: 'rgba(26, 58, 40, 0.09)',
  TEXT_PRIMARY: '#1a3a28', TEXT_SECONDARY: '#4a7060', TEXT_MUTED: '#6b8478',
  ACCENT: '#f59e0b', ACCENT_LIGHT: '#fef3c7',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  SHADOW_CARD: '0 20px 40px -18px rgba(26, 58, 40, 0.20)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirectTo');
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
  const isTimeout = searchParams.get('reason') === 'timeout';
  const urlReason = searchParams.get('reason');
  const urlMsg = searchParams.get('msg');
  const initialError = urlReason === 'kvkk-rejected' && urlMsg ? urlMsg : '';

  const [showPassword, setShowPassword] = useState(false);
  // Tek alan UX: kullanıcı email veya 11 haneli TC girer, sistem otomatik tip tespiti yapar.
  // Subdomain'de orgSlug auto-set olur (TC çakışması daralır), apex'te null
  // — TC birden fazla aktif org'da varsa server orgPickRequired döner.
  const [identifier, setIdentifier] = useState('');
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgPickList, setOrgPickList] = useState<{ slug: string; name: string }[] | null>(null);
  const [pickedOrg, setPickedOrg] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [kvkkBearerToken, setKvkkBearerToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Subdomain'den orgSlug çıkar — TC çakışması bu org'a daraltılır.
  // Apex'te orgSlug null kalır, server gerekirse orgPickRequired döner.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    const host = window.location.hostname;
    if (!baseDomain || host === baseDomain || host.includes('localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      setOrgSlug(null);
      return;
    }
    const suffix = '.' + baseDomain;
    if (host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      if (slug && slug !== 'www') {
        setOrgSlug(slug);
      }
    }
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

        if (session.access_token) setKvkkBearerToken(session.access_token);
        setPendingRedirect(target);
      } catch {
        // Session okunamadı — form olduğu gibi kalır
      }
    })();
    return () => { cancelled = true; };
  }, [urlReason]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = identifier.trim();
    const looksLikeTc = /^\d{11}$/.test(trimmed);
    const looksLikeEmail = trimmed.includes('@');

    if (!trimmed) {
      setError('E-posta veya TC Kimlik No girin.');
      return;
    }
    if (!looksLikeTc && !looksLikeEmail) {
      setError('Geçerli bir e-posta veya 11 haneli TC Kimlik No girin.');
      return;
    }
    // TC için client-side checksum ön kontrolü — ağ trafiğini boşa harcamamak için.
    if (looksLikeTc && !isValidTcKimlik(normalizeTcKimlik(trimmed))) {
      setError('Geçersiz TC Kimlik No.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        identifier: looksLikeTc ? normalizeTcKimlik(trimmed) : trimmed,
        password,
        rememberMe,
        // pickedOrg: kullanıcı dropdown'dan hastanesini seçti; orgSlug: subdomain auto-detect
        orgSlug: pickedOrg ?? orgSlug ?? undefined,
      };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 429) {
        setError('Çok fazla giriş denemesi. 15 dakika bekleyin.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const fallback = looksLikeTc ? 'TC Kimlik No veya şifre hatalı.' : 'E-posta veya şifre hatalı.';
        setError(data.error ?? fallback);
        setLoading(false);
        return;
      }

      // TC çakışması: aynı TC birden fazla aktif hastanede → kullanıcı seçim yapmalı
      if (data.orgPickRequired) {
        setOrgPickList(data.orgs);
        setLoading(false);
        return;
      }

      if (data.mfaRequired) {
        const mustChange = data.mustChangePassword ? '&mustChangePassword=1' : '';
        window.location.href = `/auth/mfa-verify?factorId=${encodeURIComponent(data.factorId)}${mustChange}`;
        return;
      }

      if (data.smsMfaRequired) {
        const mustChange = data.mustChangePassword ? '?mustChangePassword=1' : '';
        window.location.href = data.phoneMissing ? `/auth/phone-setup${mustChange}` : `/auth/sms-verify${mustChange}`;
        return;
      }

      if (data.mustChangePassword) {
        window.location.href = '/auth/change-password?reason=first-login';
        return;
      }

      const role = data.user?.role as string | undefined;
      const rolePrefix = getRolePath(role, 'dashboard');
      const isRedirectCompatible = redirectTo && redirectTo !== '/' && redirectTo.startsWith(rolePrefix);
      const targetPath = isRedirectCompatible ? redirectTo : (role && ROLE_ROUTES[role]) || '/staff/dashboard';
      // Server zaten cross-subdomain ise tam URL hesapladı (apex → subdomain).
      // Subdomain login'de data.redirectTo null → buildPostLoginUrl same-domain path döner.
      const target = data.redirectTo ?? buildPostLoginUrl(targetPath, data.organizationSlug ?? null);

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
        // Cookie'ler okunamıyorsa Bearer token fallback: login API'nin döndürdüğü
        // accessToken'ı KVKK endpoint için sakla (getAuthUser Bearer path'i destekliyor).
        if (data.session?.accessToken) setKvkkBearerToken(data.session.accessToken);
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
        bearerToken={kvkkBearerToken}
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
          height: 46px;
          padding: 0 16px;
          background: ${K.BG};
          border: 1.5px solid ${K.BORDER};
          border-radius: 12px;
          font-size: 15px;
          color: ${K.TEXT_PRIMARY};
          transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
          outline: none;
        }
        .ed-input:focus { border-color: ${K.PRIMARY}; background: ${K.BG}; box-shadow: 0 0 0 3px ${K.PRIMARY_LIGHT}; }
        .ed-input::placeholder { color: ${K.TEXT_MUTED}; opacity: 0.7; }
        .ed-checkbox {
          appearance: none;
          -webkit-appearance: none;
          border: 1.5px solid ${K.BORDER};
          background: ${K.BG};
          cursor: pointer;
          position: relative;
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

      {/* ── LEFT — Marka paneli (landing sıcak editöryel tema) ── */}
      <aside className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden">
        <LoginBrandPanel />
      </aside>

      {/* ── RIGHT — Cream Form Panel ── */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-10" style={{ background: K.BG }}>
        {/* Sıcak ambient zemin — landing paletinde yumuşak amber/emerald ışıma + nokta
            dokusu. Konumlar INLINE (arbitrary Tailwind class'ı -right-[12%] vb. bayat
            chunk'ta uygulanmayıp ışımalar kaybolurdu → boş zemin tuzağı). */}
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {/* Merkez krem wash — boş hissi kırar, sıcaklık verir */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(56% 50% at 50% 40%, rgba(245,240,230,0.6) 0%, transparent 72%)' }} />
          {/* Amber ışıma — sağ üst */}
          <div className="absolute" style={{ top: '-10%', right: '-12%', width: '55%', height: '55%', borderRadius: '9999px', background: `radial-gradient(circle, ${K.ACCENT}28 0%, transparent 68%)`, filter: 'blur(46px)' }} />
          {/* Emerald ışıma — sol alt */}
          <div className="absolute" style={{ bottom: '-14%', left: '-10%', width: '58%', height: '58%', borderRadius: '9999px', background: `radial-gradient(circle, ${K.PRIMARY}22 0%, transparent 70%)`, filter: 'blur(50px)' }} />
          {/* Nokta dokusu */}
          <div className="absolute inset-0" style={{
            opacity: 0.55,
            backgroundImage: `radial-gradient(${K.BORDER_LIGHT} 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
            maskImage: 'radial-gradient(120% 100% at 70% 25%, #000 35%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(120% 100% at 70% 25%, #000 35%, transparent 80%)',
          }} />
        </div>

        {/* Landing flat motifleri — kart çevresindeki boş alanı doldurur (lg+) */}
        <LoginFormDecorations />

        {/* maxWidth INLINE — Tailwind arbitrary class'ı (max-w-[...]) ayrı CSS chunk'ında
            üretilir; bayat chunk'ta uygulanmayıp kart w-full kalıyordu (contact sayfası
            ile aynı tuzak). Inline style SSR HTML ile gelir → her zaman uygulanır. */}
        <div className="relative z-10 w-full" style={{ maxWidth: 360 }}>
          {/* Form card */}
          <div
            className="relative"
            style={{
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 16,
              padding: '30px 32px',
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
                style={{ color: K.TEXT_PRIMARY, fontSize: '1.78rem', fontWeight: 700 }}
              >
                Hoş <span style={{ fontFamily: 'var(--font-editorial, Georgia, serif)', fontStyle: 'italic', fontWeight: 500, color: K.PRIMARY }}>geldiniz.</span>
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
                {/* Tek alan: e-posta veya 11 haneli TC. Server otomatik tip tespiti yapar. */}
                <div>
                  <label className="ed-mono text-[10px] tracking-[0.28em] mb-2 block" style={{ color: K.TEXT_PRIMARY }}>
                    E-POSTA VEYA TC KİMLİK NO
                  </label>
                  <Input
                    type="text"
                    placeholder="ornek@kurum.com veya 11 haneli TC"
                    value={identifier}
                    onChange={(e) => {
                      // Sayı + nokta + @ + harf izinli — TC yazılırken sayıya kısıtlama yok,
                      // kullanıcı ister TC ister email yazsın aynı kutuda devam etsin.
                      setIdentifier(e.target.value);
                      // Org pick dropdown gösteriliyorsa identifier değişince temizle
                      if (orgPickList) { setOrgPickList(null); setPickedOrg(null); }
                    }}
                    autoComplete="username"
                    className="ed-input"
                    required
                    data-testid="login-identifier-input"
                  />
                </div>

                {/* Çakışma çözücü: aynı TC birden fazla aktif hastanede kayıtlı — hangi hastane? */}
                {orgPickList && orgPickList.length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: K.WARNING_BG, border: `1px solid ${K.WARNING}` }}>
                    <div className="flex items-start gap-2 mb-3">
                      <Building2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: K.WARNING }} />
                      <div className="text-[12px] leading-relaxed" style={{ color: K.TEXT_PRIMARY }}>
                        <strong>Bu TC birden fazla organizasyonda kayıtlı.</strong> Hangi organizasyona giriş yapmak istiyorsunuz?
                      </div>
                    </div>
                    <div className="space-y-2">
                      {orgPickList.map((o) => (
                        <button
                          key={o.slug}
                          type="button"
                          onClick={() => { setPickedOrg(o.slug); setError(''); }}
                          className="w-full text-left px-3 py-2 rounded-md transition-colors"
                          style={{
                            background: pickedOrg === o.slug ? K.PRIMARY : K.SURFACE,
                            color: pickedOrg === o.slug ? '#fff' : K.TEXT_PRIMARY,
                            border: `1px solid ${pickedOrg === o.slug ? K.PRIMARY : K.BORDER_LIGHT}`,
                          }}
                          data-testid={`login-org-pick-${o.slug}`}
                        >
                          {o.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                    style={{
                      width: 16,
                      height: 16,
                      minWidth: 16,
                      minHeight: 16,
                      maxWidth: 16,
                      maxHeight: 16,
                      flexShrink: 0,
                      flexGrow: 0,
                      aspectRatio: '1 / 1',
                    }}
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
                    height: 48,
                    background: K.PRIMARY,
                    color: '#ffffff',
                    border: `1.5px solid ${K.PRIMARY}`,
                    borderRadius: 999,
                    boxShadow: `0 8px 24px ${K.PRIMARY}33`,
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
              <span style={{ color: K.PRIMARY }}>{BRAND.name.toUpperCase()} LMS</span>
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
