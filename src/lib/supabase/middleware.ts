import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extractSubdomain } from '@/lib/organization-utils'
import { getCookieDomain } from './cookie-domain'

const PUBLIC_ROUTES = [
  '/',
  '/kvkk',
  '/pricing',
  '/demo',
  '/contact',
  '/auth/login',
  '/auth/callback',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/mfa-verify',
  '/auth/mfa-setup',
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
]

function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || PUBLIC_ROUTES.some((route) => route !== '/' && pathname.startsWith(route))
}

const VALID_ROLES = ['super_admin', 'admin', 'staff'] as const
type ValidRole = (typeof VALID_ROLES)[number]

function sanitizeRole(raw: unknown): ValidRole {
  if (typeof raw === 'string' && (VALID_ROLES as readonly string[]).includes(raw)) {
    return raw as ValidRole
  }
  return 'staff'
}

/** Supabase çağrılarının proxy'yi kilitlemesini engeller */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // ── Subdomain / Custom Domain Algılama ──
  // Performans notu: DB sorgusu YOK — sadece host header parse + cookie/header set.
  // Gerçek org doğrulaması login sayfasında ve API route'larında yapılır.
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || ''
  const host = request.headers.get('host') || ''

  const subdomain = baseDomain ? extractSubdomain(host, baseDomain) : null
  const existingOrgSlug = request.cookies.get('x-org-slug')?.value

  const cookieDomain = getCookieDomain()

  if (subdomain) {
    // Subdomain tespit edildi — cookie ve header olarak downstream'e ilet
    supabaseResponse.headers.set('x-org-slug', subdomain)
    supabaseResponse.cookies.set('x-org-slug', subdomain, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 86400, // 1 gün
      // Cross-subdomain paylaşım: cookie '.klinovax.com' altında set'lenir,
      // hem apex hem her subdomain'de görünür.
      ...(cookieDomain && { domain: cookieDomain }),
    })

    // Subdomain'de landing page ziyaret edilirse direkt login'e yönlendir
    // (devakent.klinovax.com → devakent.klinovax.com/auth/login?org=devakent)
    // Authenticated kullanıcılar için aşağıdaki public-route guard'ı zaten dashboard'a redirect ediyor.
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('org', subdomain)
      return NextResponse.redirect(url)
    }

    // Login sayfasına gidiliyorsa ve ?org parametresi yoksa otomatik ekle
    if (pathname === '/auth/login' && !request.nextUrl.searchParams.has('org')) {
      const url = request.nextUrl.clone()
      url.searchParams.set('org', subdomain)
      return NextResponse.redirect(url)
    }
  } else if (existingOrgSlug && !subdomain) {
    // Ana domain'e dönüldüyse org cookie'sini temizle
    // (Kullanıcı subdomain'den ana domain'e geçtiyse)
    const hostWithoutPort = host.split(':')[0]
    const baseWithoutPort = baseDomain.split(':')[0]
    if (hostWithoutPort === baseWithoutPort || hostWithoutPort === 'localhost') {
      // Domain attribute ile silmek gerekiyor — aksi takdirde browser host-only
      // cookie var sanır, '.klinovax.com'daki shared cookie silinmez.
      supabaseResponse.cookies.set('x-org-slug', '', {
        path: '/',
        maxAge: 0,
        ...(cookieDomain && { domain: cookieDomain }),
      })
    }
  }

  // ── API route'ları: middleware'de auth yapma ──
  // Her API route kendi getAuthUser() (getSession → local JWT parse) ile doğrulama yapıyor.
  // Middleware'de getUser() HTTP call'ı gereksiz (~100-150ms tasarruf per API request).
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // "7 gün açık tut" sentinel — login'de yazılır (hlms-remember-me).
  // Varsa Supabase auth cookie'lerinin refresh'inde de 7 gün maxAge zorlanır,
  // yoksa Supabase default'u session-only olduğu için tarayıcı kapanınca
  // oturum düşüyordu. Sadece "-auth-token" içeren cookie'lere uygulanır ki
  // x-org-slug gibi diğer cookie'leri etkilemesin.
  const rememberMe = request.cookies.get('hlms-remember-me')?.value === '1'
  const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            const baseOptions = rememberMe && name.includes('-auth-token')
              ? { ...options, maxAge: REMEMBER_ME_MAX_AGE }
              : options
            // Cross-subdomain paylaşım: prod'da '.klinovax.com', dev'de undefined.
            const finalOptions = cookieDomain ? { ...baseOptions, domain: cookieDomain } : baseOptions
            supabaseResponse.cookies.set(name, value, finalOptions)
          })
        },
      },
    }
  )

  // ── Public route'lar: getSession() = local JWT parse, HTTP yok ──
  // Sadece authenticated kullanıcıyı login sayfasından dashboard'a yönlendirmek için kullanılır.
  if (isPublicRoute(pathname)) {
    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), 2500)
      const sessionUser = sessionResult?.data?.session?.user
      if (sessionUser) {
        const role = sanitizeRole(sessionUser.app_metadata?.role ?? sessionUser.user_metadata?.role)
        const kvkkAck = sessionUser.user_metadata?.kvkk_notice_acknowledged_at ?? null

        // KVKK onaylanmamış authenticated kullanıcı — /auth/login'de kalması gerek ki modal açılsın.
        // Landing (/) gibi public sayfalardan login'e yönlendir, modal zorunlu.
        if (!kvkkAck) {
          if (pathname === '/auth/login') {
            return supabaseResponse
          }
          if (pathname === '/') {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/login'
            url.searchParams.set('reason', 'kvkk-required')
            return NextResponse.redirect(url)
          }
          // Diğer public sayfalar (/kvkk, /pricing, vb.): serbest — zaten login gerektirmeyen içerik
          return supabaseResponse
        }

        // KVKK tamam: login/landing'de auth'luysa dashboard'a gönder (mevcut davranış)
        if (pathname === '/auth/login' || pathname === '/') {
          return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
        }
      }
    } catch {
      // Session parse başarısız — public sayfayı normal göster
    }
    return supabaseResponse
  }

  // ── Protected route'lar: getSession() = local JWT parse (HTTP yok) ──
  // getUser() her istekte Supabase'e HTTP call yapıyordu (~100-200ms per request).
  // Dev modda HMR + concurrent requests sunucuyu dondurabiliyor.
  // getSession() local JWT parse ile çalışır — token refresh cookie handler'da olur.
  // Güvenlik notu: JWT zaten Supabase tarafından imzalanmış, manipüle edilemez.
  try {
    const sessionResult = await withTimeout(supabase.auth.getSession(), 2500)
    const user = sessionResult?.data?.session?.user ?? null

    // Unauthenticated veya timeout → login'e yönlendir
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      if (pathname && pathname.startsWith('/') && !pathname.startsWith('//')) {
        url.searchParams.set('redirectTo', pathname)
      }
      return NextResponse.redirect(url)
    }

    // ── SMS MFA pending guard ──
    // Login endpoint'i SMS MFA gerektiren orgların user'larına 'hlms-sms-pending=1'
    // cookie'si set eder. Bu cookie varsa kullanıcı SMS'i tamamlamadan hiçbir
    // protected route'a giremez. Verify endpoint'i cookie'yi siler.
    // Cookie-only kontrol → middleware'de DB sorgusu YOK (performans).
    const smsPending = request.cookies.get('hlms-sms-pending')?.value === '1'
    if (smsPending && !pathname.startsWith('/auth/sms-verify') && !pathname.startsWith('/auth/phone-setup') && !pathname.startsWith('/auth/logout')) {
      return NextResponse.redirect(new URL('/auth/sms-verify', request.url))
    }

    // ── KVKK onay guard ──
    // user_metadata'da kvkk_notice_acknowledged_at yoksa kullanıcı hiçbir
    // protected route'a giremez. Login sayfasında ?reason=kvkk-required ile
    // modal otomatik açılır. Client-side modal bypass (refresh) bu sayede
    // kapatılır — enforcement middleware'de, JWT'den okunur (DB sorgusu yok).
    const kvkkAck = user.user_metadata?.kvkk_notice_acknowledged_at ?? null
    if (!kvkkAck) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      url.searchParams.set('reason', 'kvkk-required')
      return NextResponse.redirect(url)
    }

    // Role-based access control — app_metadata tercih edilir (kullanıcı değiştiremez)
    const role = sanitizeRole(user.app_metadata?.role ?? user.user_metadata?.role)

    // /super-admin/* → sadece super_admin
    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    // /admin/* → admin veya super_admin
    if (pathname.startsWith('/admin') && !(['admin', 'super_admin'] as ValidRole[]).includes(role)) {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    // /staff/* → staff, admin veya super_admin (tum roller)
    if (pathname.startsWith('/staff') && !VALID_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    // /exam/* → staff veya ustu
    if (pathname.startsWith('/exam') && !VALID_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }

    return supabaseResponse
  } catch {
    // Supabase unreachable — redirect to login for protected routes
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }
}

function getDashboardUrl(role: ValidRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard'
    case 'admin':
      return '/admin/dashboard'
    default:
      return '/staff/dashboard'
  }
}
