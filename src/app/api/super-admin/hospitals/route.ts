import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination, getAppUrl } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createHospitalWithAdminSchema } from '@/lib/validations'
import { sendInvitationEmail } from '@/lib/email'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { slugify } from '@/lib/organization'
import { logger } from '@/lib/logger'
import {
  generateInvitationToken,
  computeInvitationExpiry,
  buildInvitationUrl,
  INVITATION_TTL_HOURS,
} from '@/lib/invitations'

export const GET = withSuperAdminRoute(async ({ request }) => {
  const { searchParams } = new URL(request.url)
  const { page, limit, search, skip } = safePagination(searchParams, 500)
  const status = searchParams.get('status') // active | suspended | all

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (status === 'active') where.isActive = true
  if (status === 'suspended') where.isSuspended = true

  const [hospitals, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true, trainings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ])

  return jsonResponse({ hospitals, total, page, limit, totalPages: Math.ceil(total / limit) })
})

/**
 * POST /api/super-admin/hospitals
 *
 * Yeni hastane oluştur ve Esas Yönetici davet linki gönder.
 *
 * Akış (link tabanlı, Slack/Linear pattern):
 * 1. Organization + Subscription + TrainingCategory (transaction) — owner_user_id NULL
 * 2. Invitation token (setAsOwner=true, role=admin)
 * 3. sendInvitationEmail (link 72 saat geçerli)
 * 4. Davet eden kişi tıkladığında /davet/[token] sayfasında kendi şifresini kurar,
 *    o anda createAuthUser + Organization.ownerUserId set edilir.
 */
export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createHospitalWithAdminSchema.safeParse(body)
  if (!parsed.success) {
    const friendly = parsed.error.issues.map((i) => {
      const field = i.path.join('.')
      if (field === 'email' || field === 'adminEmail') {
        return field === 'adminEmail'
          ? 'Yönetici e-posta adresi geçersiz. Türkçe karakter (ş, ç, ğ, ü, ö, ı, İ) kullanmayın.'
          : 'Hastane e-posta adresi geçersiz. Türkçe karakter (ş, ç, ğ, ü, ö, ı, İ) kullanmayın.'
      }
      if (field === 'name') return 'Hastane adı zorunludur'
      if (field === 'code') return 'Hastane kodu zorunludur'
      if (field === 'adminFirstName') return 'Yönetici adı zorunludur'
      if (field === 'adminLastName') return 'Yönetici soyadı zorunludur'
      if (field === 'phone') return 'Geçerli bir telefon numarası girin'
      return i.message
    }).join(' • ')
    return errorResponse(friendly, 400)
  }

  // adminPassword artık kullanılmıyor (link tabanlı davet) — schema'da optional, sessizce yok say
  const { adminFirstName, adminLastName, adminEmail, planId, trialDays, ...orgData } = parsed.data

  // Hastane kodu benzersiz mi?
  const existing = await prisma.organization.findUnique({ where: { code: orgData.code } })
  if (existing) return errorResponse('Bu kod zaten kullanılıyor', 409)

  // Slug oluştur (hastane adından otomatik) ve benzersiz yap
  let slug = slugify(orgData.name)
  if (slug.length < 3) slug = slugify(orgData.code)

  let slugCandidate = slug
  let slugSuffix = 1
  while (await prisma.organization.findUnique({ where: { slug: slugCandidate } })) {
    slugCandidate = `${slug}-${slugSuffix}`
    slugSuffix++
  }
  slug = slugCandidate

  // Davet edilecek admin'in email'i sistemde başka bir hesapta mevcut mu?
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } })
  if (existingUser) return errorResponse('Bu e-posta adresi sistemde başka bir kullanıcıya kayıtlı', 409)

  // Plan doğrulama
  if (planId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan) return errorResponse('Belirtilen abonelik planı bulunamadı', 404)
  }

  // 1) Transaction: Organization + Subscription + TrainingCategory
  const hospital = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        ...orgData,
        slug,
        // Setup wizard kaldırıldı — yeni hastane direkt aktif
        setupCompleted: true,
        createdBy: dbUser.id,
      },
    })

    if (planId) {
      const trialEndsAt = trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
        : null

      await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId,
          status: trialEndsAt ? 'trialing' : 'active',
          billingCycle: 'monthly',
          ...(trialEndsAt && { trialEndsAt }),
        },
      })
    }

    await tx.trainingCategory.createMany({
      data: TRAINING_CATEGORIES.map((cat, i) => ({
        organizationId: org.id,
        value: cat.value,
        label: cat.label,
        icon: cat.icon,
        order: i,
        isDefault: true,
      })),
    })

    return org
  })

  // 2) Invitation token oluştur (setAsOwner=true)
  const { raw, hash } = generateInvitationToken()
  const expiresAt = computeInvitationExpiry()

  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: hash,
      email: adminEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      phone: null,
      title: null,
      role: 'admin',
      organizationId: hospital.id,
      invitedByUserId: dbUser.id,
      setAsOwner: true,
      expiresAt,
    },
    select: { id: true },
  })

  // Audit log
  await audit({
    action: 'create',
    entityType: 'organization',
    entityId: hospital.id,
    newData: {
      hospitalName: orgData.name,
      hospitalCode: orgData.code,
      adminEmail,
      invitationId: invitation.id,
      planId,
      trialDays,
    },
  })

  // 3) Davet maili gönder
  const inviteUrl = buildInvitationUrl(getAppUrl(), raw)
  let emailSent = true
  try {
    emailSent = await sendInvitationEmail({
      to: adminEmail,
      organizationName: orgData.name,
      inviteUrl,
      inviterName: `${dbUser.firstName} ${dbUser.lastName}`,
      recipientName: `${adminFirstName} ${adminLastName}`,
      roleLabel: 'Esas Yönetici',
      expiresInHours: INVITATION_TTL_HOURS,
      organizationId: null, // global SMTP — hastane henüz SMTP konfigüre etmedi
    })
  } catch (emailErr) {
    emailSent = false
    logger.error('hospital-create', 'Davet maili gönderilemedi', {
      adminEmail,
      error: (emailErr as Error).message,
    })
  }

  return jsonResponse({
    ...hospital,
    invitationId: invitation.id,
    invitationExpiresAt: expiresAt,
    emailSent,
    // SMTP fallback: link'i super_admin manuel paylaşabilsin
    ...(emailSent ? {} : { inviteUrl }),
  }, 201)
})
