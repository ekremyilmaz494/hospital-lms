import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extractSubdomain } from '@/lib/organization-utils'

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

  if (subdomain) {
    // Subdomain tespit edildi — cookie ve header olarak downstream'e ilet
    supabaseResponse.headers.set('x-org-slug', subdomain)
    supabaseResponse.cookies.set('x-org-slug', subdomain, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 86400, // 1 gün
    })

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
      supabaseResponse.cookies.delete('x-org-slug')
    }
  }

  // ── API route'ları: middleware'de auth yapma ──
  // Her API route kendi getAuthUser() (getSession → local JWT parse) ile doğrulama yapıyor.
  // Middleware'de getUser() HTTP call'ı gereksiz (~100-150ms tasarruf per API request).
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── Public route'lar: getSession() = local JWT parse, HTTP yok ──
  // Sadece authenticated kullanıcıyı login sayfasından dashboard'a yönlendirmek için kullanılır.
  if (isPublicRoute(pathname)) {
    try {
      const sessionResult = await withTimeout(supabase.auth.getSession(), 2500)
      if (sessionResult?.data?.session?.user && (pathname === '/auth/login' || pathname === '/')) {
        const role = sanitizeRole(sessionResult.data.session.user.app_metadata?.role ?? sessionResult.data.session.user.user_metadata?.role)
        return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
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
