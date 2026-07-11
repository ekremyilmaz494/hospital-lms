import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withGroupRoute } from '@/lib/api-handler'
import {
  setActingOrgCookie,
  clearActingOrgCookie,
  setActingPresentCookie,
  clearActingPresentCookie,
  readActingOrgCookie,
  verifyActingOrgToken,
} from '@/lib/auth/acting-org'
import { z } from 'zod/v4'

const bodySchema = z.object({ organizationId: z.string().uuid() })
const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * POST /api/group/act-as
 *
 * Grup yöneticisi (esas yönetici) kendi grubundaki bir hastaneye TAM KONTROL ile "girer"
 * (drill-in). İmzalı `klx-acting-org` cookie'si + `klx-acting-present` varlık işareti set edilir.
 * Kendi oturumu (Supabase auth cookie) DEĞİŞMEZ. GÜVENLİK SINIRI: hedef org, yöneticinin grubuna
 * ait OLMALI — aksi halde 403. api-handler her /api/admin isteğinde bu sınırı yeniden doğrular.
 */
export const POST = withGroupRoute(async ({ request, dbUser, groupId, audit }) => {
  const body = await parseBody<{ organizationId: string }>(request)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return errorResponse('Geçersiz istek gövdesi', 400)

  const org = await prisma.organization.findFirst({
    where: { id: parsed.data.organizationId, groupId },
    select: { id: true, name: true, isActive: true, isSuspended: true },
  })
  if (!org) return errorResponse('Hastane bu gruba ait değil', 403)
  if (org.isSuspended) return errorResponse('Askıya alınmış hastaneye girilemez', 409)

  await setActingOrgCookie(org.id, dbUser.id)
  await setActingPresentCookie()
  await audit({
    action: 'group_owner.act_as_org',
    entityType: 'organization',
    entityId: org.id,
    newData: { organizationName: org.name, mode: 'group_rw' },
  })

  return jsonResponse({ ok: true, organizationId: org.id, organizationName: org.name }, 200, NO_STORE)
})

/**
 * DELETE /api/group/act-as
 * Drill-in'i sonlandırır (yalnız drill-in cookie'lerini siler; auth oturumu korunur).
 */
export const DELETE = withGroupRoute(async ({ audit }) => {
  await clearActingOrgCookie()
  await clearActingPresentCookie()
  await audit({ action: 'group_owner.exit_act_as', entityType: 'organization', entityId: null })
  return jsonResponse({ ok: true }, 200, NO_STORE)
})

/**
 * GET /api/group/act-as
 * Aktif drill-in durumunu döner (admin panelindeki grup düzenleme banner'ı için).
 */
export const GET = withGroupRoute(async ({ request, dbUser, groupId }) => {
  const orgId = verifyActingOrgToken(readActingOrgCookie(request), dbUser.id, Date.now())
  if (!orgId) return jsonResponse({ active: false }, 200, NO_STORE)

  // Yalnız hâlâ gruba ait bir org ise aktif say (org gruptan çıkarıldıysa banner göstermez).
  const org = await prisma.organization.findFirst({
    where: { id: orgId, groupId },
    select: { name: true },
  })
  if (!org) return jsonResponse({ active: false }, 200, NO_STORE)

  return jsonResponse({ active: true, organizationId: orgId, organizationName: org.name }, 200, NO_STORE)
})
