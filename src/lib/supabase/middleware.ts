import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/kvkk', '/auth/login', '/auth/callback', '/auth/forgot-password', '/auth/reset-password', '/auth/mfa-verify', '/auth/mfa-setup', '/api/health', '/api/docs', '/api/cron/', '/api/payments/callback', '/help', '/certificates/verify']

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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

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
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && (pathname === '/auth/login' || pathname === '/')) {
        const role = sanitizeRole(session.user.user_metadata?.role)
        return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
      }
    } catch {
      // Session parse başarısız — public sayfayı normal göster
    }
    return supabaseResponse
  }

  // ── Protected route'lar: getUser() = Supabase'e HTTP call (token doğrulama + refresh) ──
  // Bu route'lar güvenlik-kritik: gerçek JWT doğrulaması ve token refresh gerekli.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Unauthenticated → login'e yönlendir
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      if (pathname && pathname.startsWith('/') && !pathname.startsWith('//')) {
        url.searchParams.set('redirectTo', pathname)
      }
      return NextResponse.redirect(url)
    }

    // Role-based access control — enum doğrulaması ile manipülasyonu engelle
    const role = sanitizeRole(user.user_metadata?.role)

    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    if (pathname.startsWith('/staff') && role !== 'staff') {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url))
    }
    if (pathname.startsWith('/exam') && role !== 'staff') {
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
