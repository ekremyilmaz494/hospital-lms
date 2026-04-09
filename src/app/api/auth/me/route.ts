import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { isDemoMode, parseDemoSession, DEMO_SESSION_COOKIE } from '@/lib/demo-auth'

export async function GET() {
  // ── Demo mode: Supabase yoksa demo cookie'den kullanıcı bilgisi döndür ──
  if (isDemoMode()) {
    const cookieStore = await cookies()
    const demoCookie = cookieStore.get(DEMO_SESSION_COOKIE)?.value
    const demoUser = demoCookie ? parseDemoSession(demoCookie) : null
    if (!demoUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      {
        user: {
          ...demoUser,
          organizationName: demoUser.organizationId ? 'Demo Hastanesi' : null,
          sessionTimeout: 30,
        },
      },
      { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=60' } }
    )
  }

  const supabase = await createClient()
  // getSession() = local JWT parse, no HTTP round-trip to Supabase Auth server.
  // Middleware already validated the token with getUser() on every request.
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      departmentId: true,
      title: true,
      phone: true,
      avatarUrl: true,
      isActive: true,
      kvkkConsent: true,
      kvkkConsentDate: true,
      createdAt: true,
      updatedAt: true,
      departmentRel: { select: { name: true } },
      organization: { select: { name: true, sessionTimeout: true } },
    },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      user: {
        ...dbUser,
        department: dbUser.departmentRel?.name ?? null,
        organizationName: dbUser.organization?.name ?? null,
        sessionTimeout: dbUser.organization?.sessionTimeout ?? 30,
      },
    },
    { headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=60' } }
  )
}
