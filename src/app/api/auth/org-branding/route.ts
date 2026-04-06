import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    })

    if (!dbUser?.organizationId) {
      return NextResponse.json({ error: 'Organizasyon bulunamadi' }, { status: 404 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: dbUser.organizationId },
      select: {
        name: true,
        code: true,
        logoUrl: true,
        brandColor: true,
        secondaryColor: true,
      },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organizasyon bulunamadi' }, { status: 404 })
    }

    return NextResponse.json(org, {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatasi' }, { status: 500 })
  }
}
