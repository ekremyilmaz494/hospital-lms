import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This is a skeleton middleware for role-based routing
// In production, this will verify JWT tokens from Supabase Auth

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ['/auth/login', '/auth/forgot-password'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // TODO: In production, check for auth token
  // const token = request.cookies.get('sb-access-token')?.value;
  // if (!token) {
  //   return NextResponse.redirect(new URL('/auth/login', request.url));
  // }

  // TODO: Verify role and redirect if unauthorized
  // const userRole = decodeToken(token).role;
  // if (pathname.startsWith('/super-admin') && userRole !== 'super_admin') {
  //   return NextResponse.redirect(new URL('/auth/login', request.url));
  // }
  // if (pathname.startsWith('/admin') && userRole !== 'admin') {
  //   return NextResponse.redirect(new URL('/auth/login', request.url));
  // }
  // if (pathname.startsWith('/staff') && userRole !== 'staff') {
  //   return NextResponse.redirect(new URL('/auth/login', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
