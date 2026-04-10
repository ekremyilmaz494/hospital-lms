import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'

/**
 * GET /api/auth/org-branding
 * Authenticated kullanicinin organizasyon branding bilgilerini doner.
 * Layout'larda sidebar/topbar'da kullanilir.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const cacheKey = `org-branding:${userId}`

    // Redis cache — branding nadiren değişir (10 dk TTL)
    const cached = await getCached<object>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      })
    }

    // Tek sorgu: user → organization join ile
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        organization: {
          select: {
            name: true,
            code: true,
            logoUrl: true,
            brandColor: true,
            secondaryColor: true,
          },
        },
      },
    })

    if (!dbUser?.organization) {
      return NextResponse.json({ error: 'Organizasyon bulunamadi' }, { status: 404 })
    }

    await setCached(cacheKey, dbUser.organization, 600)

    return NextResponse.json(dbUser.organization, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatasi' }, { status: 500 })
  }
}
