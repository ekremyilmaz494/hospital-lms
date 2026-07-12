import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { turkishSearchIds } from '@/lib/turkish-search'
import { createGroupWithOwnerSchema } from '@/lib/validations'
import { slugify } from '@/lib/organization'
import { sendStaffWelcomeEmail } from '@/lib/email'
import { createGroupOwnerUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'
import type { z } from 'zod/v4'

/**
 * GET /api/super-admin/groups
 * Hastane gruplarını (çok-hastaneli müşteriler) listeler — hastane sayısı + sahip bilgisi ile.
 */
export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, search } = safePagination(searchParams, 200)

  const where: Record<string, unknown> = {}
  if (search) {
    where.id = { in: await turkishSearchIds('organization_groups', ['name', 'code'], search) }
  }

  const [groups, total] = await Promise.all([
    prisma.organizationGroup.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        maxOrganizations: true,
        isActive: true,
        createdAt: true,
        ownerUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { organizations: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizationGroup.count({ where }),
  ])

  return jsonResponse(
    { groups, total, page, limit, totalPages: Math.ceil(total / limit) },
    200,
    { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  )
})

/**
 * POST /api/super-admin/groups
 *
 * Yeni hastane grubu + grup yöneticisi (esas yönetici) oluşturur. Provizyon Klinovax-only.
 * Grup yöneticisi DIRECT modda açılır (geçici şifre üretilir, elden teslim); hastaneler ayrı
 * bir adımda gruba bağlanır (/api/super-admin/groups/[id]/organizations).
 */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody<z.infer<typeof createGroupWithOwnerSchema>>(request)
  const parsed = createGroupWithOwnerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Geçersiz veri', 400)
  }
  const data = parsed.data

  // Grup kodu — verilmezse addan üret; benzersiz olmalı.
  const baseCode = (data.code ?? slugify(data.name)).slice(0, 50) || 'grup'
  let code = baseCode
  const existing = await prisma.organizationGroup.findUnique({ where: { code }, select: { id: true } })
  if (existing) {
    if (data.code) return errorResponse('Bu grup kodu zaten kullanılıyor', 409)
    // Otomatik kod çakıştıysa kısa rastgele sonek ekle.
    code = `${baseCode.slice(0, 43)}-${randomBytes(3).toString('hex')}`
  }

  // 1) Grubu oluştur (owner_user_id NULL — owner user'ı birazdan bağlarız).
  const group = await prisma.organizationGroup.create({
    data: {
      name: data.name,
      code,
      maxOrganizations: data.maxOrganizations ?? null,
      logoUrl: data.logoUrl || null,
      ...(data.brandColor && { brandColor: data.brandColor }),
      createdBy: dbUser.id,
    },
    select: { id: true, name: true, code: true, maxOrganizations: true, brandColor: true, isActive: true, createdAt: true },
  })

  // 2) Grup yöneticisi (esas yönetici) hesabı — geçici şifre üret.
  const effectivePassword = data.ownerPassword || ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1')
  let ownerResult
  try {
    ownerResult = await createGroupOwnerUser({
      email: data.ownerEmail,
      password: effectivePassword,
      firstName: data.ownerFirstName,
      lastName: data.ownerLastName,
      groupId: group.id,
      mustChangePassword: true,
    })
  } catch (err) {
    // Grup oluşturuldu ama owner açılamadı — grubu geri al (yetimi önle).
    await prisma.organizationGroup.delete({ where: { id: group.id } }).catch(() => {})
    logger.error('group-create', 'Grup yöneticisi User yaratılamadı (grup geri alındı)', {
      groupId: group.id,
      ownerEmail: data.ownerEmail,
      error: err instanceof Error ? err.message : err,
    })
    if (err instanceof AuthUserError || err instanceof DbUserError) {
      return errorResponse(`Grup oluşturulamadı: ${err.safeMessage}`, 500)
    }
    throw err
  }

  const ownerUser = ownerResult.dbUser

  // 3) Grubu owner'a bağla.
  await prisma.organizationGroup.update({
    where: { id: group.id },
    data: { ownerUserId: ownerUser.id },
  })

  await audit({
    action: 'create',
    entityType: 'organization_group',
    entityId: group.id,
    newData: {
      groupName: group.name,
      groupCode: group.code,
      ownerUserId: ownerUser.id,
      ownerEmail: data.ownerEmail,
      maxOrganizations: group.maxOrganizations,
    },
  })

  // 4) Hoş geldiniz maili — grup yöneticisi apex'te login olur (org subdomain'i yok).
  let welcomeEmailSent = false
  try {
    await sendStaffWelcomeEmail({
      to: data.ownerEmail,
      staffName: `${ownerUser.firstName} ${ownerUser.lastName}`,
      organizationName: group.name,
      brandColor: group.brandColor,
      tempPassword: effectivePassword,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/login`,
    })
    welcomeEmailSent = true
  } catch (err) {
    logger.warn('group-create', `Grup yöneticisi hoş geldiniz maili gönderilemedi: ${data.ownerEmail}`, err instanceof Error ? err.message : err)
  }

  return jsonResponse(
    {
      ...group,
      ownerUserId: ownerUser.id,
      emailSent: welcomeEmailSent,
      // Geçici şifre — super-admin elden teslim için her durumda dön.
      tempPassword: effectivePassword,
    },
    201,
  )
})
