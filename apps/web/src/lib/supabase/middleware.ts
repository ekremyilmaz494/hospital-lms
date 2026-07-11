import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { extractSubdomain } from '@/lib/organization-utils';
import { getCookieDomain } from './cookie-domain';
import { verifyAccessToken } from './verify-jwt';
import { getServerSupabaseUrl, getSupabaseCookieOptions } from './onprem-config';
import { isKvkkNoticeCurrent } from '@/lib/kvkk/notice-version';
import { hasAdminAuthority } from '@/lib/auth/admin-authority';
import { hasGroupAuthority } from '@/lib/auth/group-authority';

const PUBLIC_ROUTES = [
  '/',
  '/kvkk',
  '/pricing', // route silindi; public kalsın ki login'e değil temiz 404'e düşsün
  '/demo',
  '/sectors/',
  '/contact',
  '/auth/login',
  '/auth/callback',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/mfa-verify',
  '/auth/mfa-setup',
  '/davet/',
  '/api/auth/invitations/',
  '/api/health',
  '/api/docs',
  '/docs',
  '/api/cron/',
  '/api/payments/callback',
  '/terms',
  '/privacy',
  '/help',
  '/register',
  '/certificates/verify',
  '/api/public/',
  '/dev-reset',
  '/clear-cache',
  '/license', // on-prem lisans aktivasyon/yenileme ekranı (kilitliyken erişilebilir)
  '/api/license/', // durum + aktivasyon uçları (kilitliyken erişilebilir)
];

function isPublicRoute(pathname: string): boolean {
  return (
    pathname === '/' || PUBLIC_ROUTES.some((route) => route !== '/' && pathname.startsWith(route))
  );
}

const VALID_ROLES = ['super_admin', 'admin', 'staff'] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function sanitizeRole(raw: unknown): ValidRole {
  if (typeof raw === 'string' && (VALID_ROLES as readonly string[]).includes(raw)) {
    return raw as ValidRole;
  }
  return 'staff';
}

/** Supabase çağrılarının proxy'yi kilitlemesini engeller */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // ── Subdomain / Custom Domain Algılama ──
  // Performans notu: DB sorgusu YOK — sadece host header parse + cookie/header set.
  // Gerçek org doğrulaması login sayfasında ve API route'larında yapılır.
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || '';
  const host = request.headers.get('host') || '';

  const subdomain = baseDomain ? extractSubdomain(host, baseDomain) : null;
  const existingOrgSlug = request.cookies.get('x-org-slug')?.value;

  const cookieDomain = getCookieDomain();

  if (subdomain) {
    // Subdomain tespit edildi — cookie ve header olarak downstream'e ilet
    supabaseResponse.headers.set('x-org-slug', subdomain);
    supabaseResponse.cookies.set('x-org-slug', subdomain, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 86400, // 1 gün
      // Cross-subdomain paylaşım: cookie '.klinovax.com' altında set'lenir,
      // hem apex hem her subdomain'de görünür.
      ...(cookieDomain && { domain: cookieDomain }),
    });

    // Subdomain'de landing page ziyaret edilirse direkt login'e yönlendir
    // (devakent.klinovax.com → devakent.klinovax.com/auth/login?org=devakent)
    // Authenticated kullanıcılar için aşağıdaki public-route guard'ı zaten dashboard'a redirect ediyor.
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('org', subdomain);
      return NextResponse.redirect(url);
    }

    // Login sayfasına gidiliyorsa ve ?org parametresi yoksa otomatik ekle
    if (pathname === '/auth/login' && !request.nextUrl.searchParams.has('org')) {
      const url = request.nextUrl.clone();
      url.searchParams.set('org', subdomain);
      return NextResponse.redirect(url);
    }
  } else if (existingOrgSlug && !subdomain) {
    // Ana domain'e dönüldüyse org cookie'sini temizle
    // (Kullanıcı subdomain'den ana domain'e geçtiyse)
    const hostWithoutPort = host.split(':')[0];
    const baseWithoutPort = baseDomain.split(':')[0];
    if (hostWithoutPort === baseWithoutPort || hostWithoutPort === 'localhost') {
      // Domain attribute ile silmek gerekiyor — aksi takdirde browser host-only
      // cookie var sanır, '.klinovax.com'daki shared cookie silinmez.
      supabaseResponse.cookies.set('x-org-slug', '', {
        path: '/',
        maxAge: 0,
        ...(cookieDomain && { domain: cookieDomain }),
      });
    }
  }

  // ── API route'ları: middleware'de auth yapma ──
  // Her API route kendi getAuthUser() (getSession → local JWT parse) ile doğrulama yapıyor.
  // Middleware'de getUser() HTTP call'ı gereksiz (~100-150ms tasarruf per API request).
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  // "7 gün açık tut" sentinel — login'de yazılır (hlms-remember-me).
  // Varsa Supabase auth cookie'lerinin refresh'inde de 7 gün maxAge zorlanır,
  // yoksa Supabase default'u session-only olduğu için tarayıcı kapanınca
  // oturum düşüyordu. Sadece "-auth-token" içeren cookie'lere uygulanır ki
  // x-org-slug gibi diğer cookie'leri etkilemesin.
  const rememberMe = request.cookies.get('hlms-remember-me')?.value === '1';
  const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60;

  const supabase = createServerClient(
    getServerSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const baseOptions =
              rememberMe && name.includes('-auth-token')
                ? { ...options, maxAge: REMEMBER_ME_MAX_AGE }
                : options;
            // Cross-subdomain paylaşım: prod'da '.klinovax.com', dev'de undefined.
            const finalOptions = cookieDomain
              ? { ...baseOptions, domain: cookieDomain }
              : baseOptions;
            supabaseResponse.cookies.set(name, value, finalOptions);
          });
        },
      },
    }
  );

  // ── Public route'lar: getSession() = local JWT parse, HTTP yok ──
  // Sadece authenticated kullanıcıyı login sayfasından dashboard'a yönlendirmek için kullanılır.
  if (isPublicRoute(pathname)) {
    // Fast-path: auth cookie yoksa → session de yok → getSession() çağrısı gereksiz.
    // Bu sayede unauthenticated kullanıcılar login/landing sayfasına anında ulaşır,
    // 2500ms timeout'u beklemek zorunda kalmaz.
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    if (!hasAuthCookie) {
      return supabaseResponse;
    }
    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), 2500);
      const session = sessionResult?.data?.session;
      // getSession() imzayı doğrulamaz — token'ı kriptografik doğrula, rolü buradan al.
      const verified = session ? await verifyAccessToken(session.access_token) : null;
      const sessionUser =
        session && verified && verified.sub === session.user.id ? session.user : undefined;
      if (sessionUser) {
        const role = sanitizeRole(verified?.role);
        const groupOwner = verified?.groupOwner ?? false;
        // Aydınlatma metni sürümü güncel değilse yeniden onay iste. TEK kaynak
        // isKvkkNoticeCurrent — login sayfasının modal-tetiğiyle AYNI kriter (sürüm-duyarlı);
        // aksi halde v1 onaylı kullanıcı login ⇄ dashboard sonsuz döngüsüne girer.
        const kvkkOk = isKvkkNoticeCurrent(sessionUser.user_metadata);

        // KVKK onaylanmamış/eski sürüm authenticated kullanıcı — /auth/login'de kalmalı ki modal açılsın.
        // Landing (/) gibi public sayfalardan login'e yönlendir, modal zorunlu.
        if (!kvkkOk) {
          if (pathname === '/auth/login') {
            return supabaseResponse;
          }
          if (pathname === '/') {
            const url = request.nextUrl.clone();
            url.pathname = '/auth/login';
            url.searchParams.set('reason', 'kvkk-required');
            return NextResponse.redirect(url);
          }
          // Diğer public sayfalar (/kvkk, /pricing, vb.): serbest — zaten login gerektirmeyen içerik
          return supabaseResponse;
        }

        // KVKK tamam: login/landing'de auth'luysa dashboard'a gönder (mevcut davranış)
        if (pathname === '/auth/login' || pathname === '/') {
          const dashboardPath = getDashboardUrl(role, { groupOwner });
          // Apex'te authenticated kullanıcı + org cookie varsa subdomain'e zıpla.
          // Cookie cross-subdomain (.klinovax.com) — önceki subdomain ziyaretinde set edildi.
          // super_admin ve grup yöneticisi için org cookie yok → apex'te kal (konsolide panel).
          const orgSlugCookie = request.cookies.get('x-org-slug')?.value;
          if (
            baseDomain &&
            !subdomain &&
            orgSlugCookie &&
            role !== 'super_admin' &&
            !groupOwner &&
            !baseDomain.includes('localhost')
          ) {
            const protocol = request.nextUrl.protocol || 'https:';
            return NextResponse.redirect(
              `${protocol}//${orgSlugCookie}.${baseDomain}${dashboardPath}`
            );
          }
          return NextResponse.redirect(new URL(dashboardPath, request.url));
        }
      }
    } catch {
      // Session parse başarısız — public sayfayı normal göster
    }
    return supabaseResponse;
  }

  // ── Protected route'lar: getSession() + yerel imza doğrulaması ──
  // getSession() local JWT parse (HTTP yok) ile token'ı çerezden okur — token refresh
  // cookie handler'da olur. ANCAK getSession() imzayı doğrulamaz; bu yüzden access_token
  // verifyAccessToken (jose/JWKS, yerel ES256 doğrulaması) ile kriptografik kontrol edilir.
  // getUser()'a göre HTTP round-trip yok ama imza güvenliği korunur.
  try {
    const sessionResult = await withTimeout(supabase.auth.getSession(), 2500);
    const session = sessionResult?.data?.session ?? null;
    // ⚠️ KRİTİK: getSession() imzayı doğrulamaz. Token'ı kriptografik doğrula ve rol
    // kararını DOĞRULANMIŞ payload'tan ver — sahte çerezle rol yükseltmeyi engelle.
    const verified = session ? await verifyAccessToken(session.access_token) : null;
    const user = session && verified && verified.sub === session.user.id ? session.user : null;

    // Unauthenticated veya timeout veya geçersiz imza → login'e yönlendir
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      if (pathname && pathname.startsWith('/') && !pathname.startsWith('//')) {
        url.searchParams.set('redirectTo', pathname);
      }
      return NextResponse.redirect(url);
    }

    // ── On-prem lisans sentinel guard ──
    // Login endpoint'i lisans kilitli/lisanssızsa 'hlms-license-state=locked' set eder.
    // Bu çerez varsa kullanıcı /license (aktivasyon) dışında hiçbir protected route'a
    // giremez — advisory hızlı-yol (asıl zorlama API kapısı + layout guard'ıdır).
    // Cookie-only kontrol → middleware'de DB/lisans okuması YOK (performans).
    const licenseLocked = request.cookies.get('hlms-license-state')?.value === 'locked';
    if (
      licenseLocked &&
      !pathname.startsWith('/license') &&
      !pathname.startsWith('/auth/logout')
    ) {
      return NextResponse.redirect(new URL('/license', request.url));
    }

    // ── Şifre değiştirme zorunluluğu guard ──
    // Login endpoint'i mustChangePassword=true olan kullanıcılara 'hlms-must-change-pw=1'
    // cookie'si set eder. Bu cookie varsa kullanıcı şifresini değiştirmeden hiçbir
    // protected route'a giremez. Change-password API cookie'yi siler.
    const mustChangePw = request.cookies.get('hlms-must-change-pw')?.value === '1';
    if (
      mustChangePw &&
      !pathname.startsWith('/auth/change-password') &&
      !pathname.startsWith('/auth/logout')
    ) {
      return NextResponse.redirect(
        new URL('/auth/change-password?reason=first-login', request.url)
      );
    }

    // ── SMS MFA pending guard ──
    // Login endpoint'i SMS MFA gerektiren orgların user'larına 'hlms-sms-pending=1'
    // cookie'si set eder. Bu cookie varsa kullanıcı SMS'i tamamlamadan hiçbir
    // protected route'a giremez. Verify endpoint'i cookie'yi siler.
    // Cookie-only kontrol → middleware'de DB sorgusu YOK (performans).
    const smsPending = request.cookies.get('hlms-sms-pending')?.value === '1';
    if (
      smsPending &&
      !pathname.startsWith('/auth/sms-verify') &&
      !pathname.startsWith('/auth/phone-setup') &&
      !pathname.startsWith('/auth/logout')
    ) {
      return NextResponse.redirect(new URL('/auth/sms-verify', request.url));
    }

    // ── KVKK onay guard ──
    // user_metadata'da kvkk_notice_acknowledged_at yoksa VEYA onaylanan aydınlatma
    // sürümü güncel değilse kullanıcı hiçbir protected route'a giremez. Login sayfasında
    // ?reason=kvkk-required ile modal otomatik açılır. Client-side modal bypass (refresh)
    // bu sayede kapatılır — enforcement middleware'de, JWT'den okunur (DB sorgusu yok).
    // Sürüm alanı YOKSA v1 kabul (grandfather) — public yol ile aynı mantık.
    const kvkkOk = isKvkkNoticeCurrent(user.user_metadata);
    if (!kvkkOk) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('reason', 'kvkk-required');
      return NextResponse.redirect(url);
    }

    // Role-based access control — DOĞRULANMIŞ JWT payload'ından (imza kontrol edildi)
    const role = sanitizeRole(verified?.role);
    const adminAccess = verified?.adminAccess ?? false;
    const groupOwner = verified?.groupOwner ?? false;
    const groupId = verified?.groupId ?? null;
    // Grup yöneticisi (esas yönetici) — TEK kaynak hasGroupAuthority (api-handler + group
    // layout ile AYNI kriter). role='admin' olsa da null org'u drill-in gerektirir.
    const groupAuthority = hasGroupAuthority({ groupOwner, groupId });
    const dash = (r: ValidRole) => getDashboardUrl(r, { groupOwner });

    // /super-admin/* → sadece super_admin (grant/grup ASLA super_admin vermez)
    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(dash(role), request.url));
    }
    // /group/* → yalnız grup yöneticisi. super_admin da grup panelini görmez (kendi
    // platform paneli var); yetkisi olmayan → kendi dashboard'ına.
    if (pathname.startsWith('/group') && !groupAuthority) {
      return NextResponse.redirect(new URL(dash(role), request.url));
    }
    // /admin/* → admin, super_admin VEYA ek yönetici yetkisi verilmiş personel (dual-capability).
    // TEK kaynak hasAdminAuthority — api-handler + admin layout ile AYNI kriter (drift yok).
    if (pathname.startsWith('/admin')) {
      if (groupAuthority) {
        // Grup yöneticisi (role='admin') hasAdminAuthority'yi geçer AMA org'u null'dur.
        // Yalnız aktif drill-in (klx-acting-present cookie, Faz 1.5) varken bir hastanenin
        // /admin panelini görür; aksi halde konsolide grup paneline yollanır (boş panel/400 önlenir).
        const drillActive = request.cookies.get('klx-acting-present')?.value === '1';
        if (!drillActive) {
          return NextResponse.redirect(new URL('/group/dashboard', request.url));
        }
      } else if (!hasAdminAuthority({ role, adminAccess })) {
        return NextResponse.redirect(new URL(dash(role), request.url));
      }
    }
    // /staff/* → staff, admin veya super_admin (tum roller)
    if (pathname.startsWith('/staff') && !VALID_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(dash(role), request.url));
    }
    // /exam/* → staff veya ustu
    if (pathname.startsWith('/exam') && !VALID_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(dash(role), request.url));
    }

    return supabaseResponse;
  } catch {
    // Supabase unreachable — redirect to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }
}

function getDashboardUrl(role: ValidRole, opts?: { groupOwner?: boolean }): string {
  // Grup yöneticisi (esas yönetici) role='admin' olsa da konsolide grup paneline gider.
  if (opts?.groupOwner) return '/group/dashboard';
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/staff/dashboard';
  }
}
