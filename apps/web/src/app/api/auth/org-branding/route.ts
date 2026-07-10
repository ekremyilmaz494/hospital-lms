import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/redis'
import { readActingOrgCookie, verifyActingOrgToken } from '@/lib/auth/acting-org'
import { checkFeature } from '@/lib/feature-gate'

/** Sidebar/topbar branding için ortak org select shape'i. */
const ORG_BRANDING_SELECT = {
  id: true,
  name: true,
  code: true,
  logoUrl: true,
  brandColor: true,
  secondaryColor: true,
  ownerUserId: true,
  maxAdmins: true,
  sector: true,
  isDemo: true,
} as const

/**
 * GET /api/auth/org-branding
 * Authenticated kullanicinin organizasyon branding bilgilerini doner.
 * Layout'larda sidebar/topbar'da kullanilir.
 *
 * Süper-admin bir org'u SALT-OKUNUR görüntülüyorsa (imzalı klx-acting-org cookie),
 * o org'un branding'i döner — aksi halde süper-admin'in kendi org'u olmadığı için
 * 404 olur ve panel markasız görünürdü. Cache key acting org'a göre ayrılır.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const role = (session.user.app_metadata?.role ?? session.user.user_metadata?.role) as
      | string
      | undefined

    // Süper-admin görüntüleme bağlamı (yalnız super_admin + geçerli imzalı cookie).
    const actingOrgId =
      role === 'super_admin'
        ? verifyActingOrgToken(readActingOrgCookie(request), userId, Date.now())
        : null

    // v7: hasScormSupport (plan feature) eklendi — sidebar SCORM menüsü gating'i.
    const cacheKey = `org-branding:v7:${userId}:${actingOrgId ?? 'self'}`

    // Redis cache — branding nadiren değişir (10 dk TTL)
    const cached = await getCached<object>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      })
    }

    // Acting modda seçilen org; aksi halde kullanıcının kendi org'u.
    // ownerUserId + maxAdmins: Esas Yönetici davet UI'ı için (sidebar gating, /admin/yoneticiler)
    const organization = actingOrgId
      ? await prisma.organization.findUnique({
          where: { id: actingOrgId },
          select: ORG_BRANDING_SELECT,
        })
      : (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { organization: { select: ORG_BRANDING_SELECT } },
          })
        )?.organization ?? null

    if (!organization) {
      return NextResponse.json({ error: 'Organizasyon bulunamadi' }, { status: 404 })
    }

    // SCORM menüsü gating'i — API gate'iyle AYNI kaynak (SubscriptionPlan.hasScormSupport).
    // org.id yalnız bu sunucu-taraf hesap için seçildi; response'ta sızdırılmaz.
    const hasScormSupport = await checkFeature(organization.id, 'scormSupport')
    const { id: _orgId, ...brandingFields } = organization
    void _orgId
    const payload = { ...brandingFields, hasScormSupport }

    await setCached(cacheKey, payload, 600)

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch {
    return NextResponse.json({ error: 'Sunucu hatasi' }, { status: 500 })
  }
}
