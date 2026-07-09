import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import {
  setActingOrgCookie,
  clearActingOrgCookie,
  readActingOrgCookie,
  verifyActingOrgToken,
} from '@/lib/auth/acting-org'
import { z } from 'zod/v4'

const bodySchema = z.object({ organizationId: z.string().uuid() })

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * POST /api/super-admin/act-as
 * Süper-admin için bir organizasyonu SALT-OKUNUR görüntüleme bağlamı başlatır.
 * Kendi süper-admin oturumu (Supabase auth cookie) DEĞİŞMEZ — yalnız imzalı
 * `klx-acting-org` cookie set edilir. İstemci sonra /admin/dashboard'a gider;
 * withApiHandler bu cookie'yi görüp /api/admin/* isteklerini bu org'a scope'lar.
 */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody<{ organizationId: string }>(request)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return errorResponse('Geçersiz istek gövdesi', 400)

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true, name: true },
  })
  if (!org) return errorResponse('Organizasyon bulunamadı', 404)

  await setActingOrgCookie(org.id, dbUser.id)
  await audit({
    action: 'super_admin.act_as_org',
    entityType: 'organization',
    entityId: org.id,
    newData: { organizationName: org.name, mode: 'read-only' },
  })

  return jsonResponse({ ok: true, organizationId: org.id, organizationName: org.name }, 200, NO_STORE)
})

/**
 * DELETE /api/super-admin/act-as
 * Görüntüleme bağlamını sonlandırır. YALNIZ `klx-acting-org` cookie'sini siler —
 * süper-admin oturumu korunur (signOut YOK), kullanıcı tekrar giriş yapmaz.
 */
export const DELETE = withSuperAdminRoute(async ({ audit }) => {
  await clearActingOrgCookie()
  await audit({ action: 'super_admin.exit_act_as', entityType: 'organization', entityId: null })
  return jsonResponse({ ok: true }, 200, NO_STORE)
})

/**
 * GET /api/super-admin/act-as
 * Aktif görüntüleme durumunu döner (admin panel banner'ı için).
 * Cookie httpOnly olduğundan istemci değeri okuyamaz; durumu buradan alır.
 */
export const GET = withSuperAdminRoute(async ({ request, dbUser }) => {
  const orgId = verifyActingOrgToken(readActingOrgCookie(request), dbUser.id, Date.now())
  if (!orgId) return jsonResponse({ active: false }, 200, NO_STORE)

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })
  return jsonResponse(
    { active: true, organizationId: orgId, organizationName: org?.name ?? '' },
    200,
    NO_STORE,
  )
})
