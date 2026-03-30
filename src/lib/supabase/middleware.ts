import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
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

    const {
      data: { user },
    } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them to the login page
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Public routes
  const publicRoutes = ['/', '/kvkk', '/auth/login', '/auth/callback', '/auth/forgot-password', '/auth/reset-password', '/auth/mfa-verify', '/auth/mfa-setup', '/api/health', '/api/docs', '/api/cron/', '/api/payments/callback', '/help', '/certificates/verify']
  if (pathname === '/' || publicRoutes.some((route) => pathname === route || (route !== '/' && pathname.startsWith(route)))) {
    // Authenticated users on login page or root → redirect to dashboard
    if (user && (pathname === '/auth/login' || pathname === '/')) {
      const role = user.user_metadata?.role as string
      const dashboardUrl = getDashboardUrl(role)
      return NextResponse.redirect(new URL(dashboardUrl, request.url))
    }
    return supabaseResponse
  }

  // Unauthenticated → login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    // Only store same-origin relative paths as redirectTo — prevents open redirect
    // e.g. /admin/dashboard is OK, https://phishing.com is NOT
    if (pathname && pathname.startsWith('/') && !pathname.startsWith('//')) {
      url.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(url)
  }

  // Role-based access control
  const role = user.user_metadata?.role as string

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
    // Supabase unreachable — only allow public routes, block protected ones
    const { pathname } = request.nextUrl
    const publicRoutes = ['/', '/kvkk', '/auth/login', '/auth/callback', '/auth/forgot-password', '/auth/reset-password', '/auth/mfa-verify', '/auth/mfa-setup', '/api/health', '/api/docs', '/api/cron/', '/api/payments/callback', '/help', '/certificates/verify']
    if (publicRoutes.some((route) => pathname === route || (route !== '/' && pathname.startsWith(route)))) {
      return NextResponse.next({ request })
    }
    // Redirect to login for protected routes when auth is unavailable
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }
}

function getDashboardUrl(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard'
    case 'admin':
      return '/admin/dashboard'
    default:
      return '/staff/dashboard'
  }
}
