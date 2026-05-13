import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination, getOrgUrl } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createHospitalWithAdminSchema } from '@/lib/validations'
import { sendInvitationEmail, sendStaffWelcomeEmail } from '@/lib/email'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { slugify } from '@/lib/organization'
import { logger } from '@/lib/logger'
import {
  generateInvitationToken,
  computeInvitationExpiry,
  buildInvitationUrl,
  INVITATION_TTL_HOURS,
} from '@/lib/invitations'
import { encryptTcKimlik, hashTcKimlik, tcAuditRef } from '@/lib/tc-crypto'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { defaultPeriodBounds } from '@/lib/training-periods'

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
        _count: {
          select: {
            users: true,
            // "Eğitim sayısı" yayındaki + aktif kayıtları gösterir — draft/arşiv
            // sayıma girmez. Aksi halde hastane admin paneliyle tutarsız olur
            // (admin sadece yayındaki eğitimleri görür).
            trainings: { where: { isActive: true, publishStatus: { not: 'archived' } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ])

  return jsonResponse({ hospitals, total, page, limit, totalPages: Math.ceil(total / limit) }, 200, { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' })
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

  // İki mod desteklenir:
  //   'invite' (default) → davet linki, esas yönetici email'den şifresini kurar
  //   'direct'           → otomatik şifre, super admin elden teslim eder
  const { mode, adminFirstName, adminLastName, adminEmail, adminTcKimlik, adminPassword, planId, trialDays, ...orgData } = parsed.data

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

  // E-posta verilmişse çakışma kontrolü yap
  if (adminEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } })
    if (existingUser) return errorResponse('Bu e-posta adresi sistemde başka bir kullanıcıya kayıtlı', 409)
  }

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

    // Yeni org için cari yıl aktif eğitim dönemi oluştur.
    // Olmadan admin atama yapamaz (getActivePeriod → 409).
    const currentYear = new Date().getFullYear()
    const { startDate: periodStart, endDate: periodEnd } = defaultPeriodBounds(currentYear)
    await tx.trainingPeriod.create({
      data: {
        organizationId: org.id,
        year: currentYear,
        label: `${currentYear} Eğitim Dönemi`,
        startDate: periodStart,
        endDate: periodEnd,
        isDefault: true,
        status: 'active',
      },
    })

    return org
  })

  // ── DIRECT MODE — Esas Yönetici hesabını anında aç, geçici şifre üret ─────
  if (mode === 'direct') {
    const effectivePassword = adminPassword ||
      ('Pass' + randomBytes(4).toString('hex').toUpperCase() + '!1')

    // E-posta verilmemişse TC hash'inden sistem e-postası üret — Supabase için gerekli.
    const effectiveEmail = adminEmail ?? `noemail-${hashTcKimlik(adminTcKimlik).slice(0, 12)}@klinovax.internal`

    let result
    try {
      result = await createAuthUser({
        email: effectiveEmail,
        password: effectivePassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin',
        organizationId: hospital.id,
        mustChangePassword: true,
        tcKimlik: adminTcKimlik,
        tcAddedByUserId: dbUser.id,
      })
    } catch (err) {
      // Hospital yarattık ama owner User yaratamadık — manuel müdahale gerek
      logger.error('hospital-create', 'Esas Yönetici User yaratılamadı (hospital orphan kaldı)', {
        hospitalId: hospital.id,
        adminEmail,
        error: err instanceof Error ? err.message : err,
      })
      if (err instanceof AuthUserError || err instanceof DbUserError) {
        return errorResponse(`Hastane oluşturuldu fakat yönetici hesabı açılamadı: ${err.safeMessage}`, 500)
      }
      throw err
    }

    const ownerUser = result.dbUser

    // Esas Yönetici (org owner) işaretle — Organization.ownerUserId set et
    await prisma.organization.update({
      where: { id: hospital.id },
      data: { ownerUserId: ownerUser.id },
    })

    await audit({
      action: 'create',
      entityType: 'organization',
      entityId: hospital.id,
      newData: {
        hospitalName: orgData.name,
        hospitalCode: orgData.code,
        adminEmail: adminEmail ?? null,
        ownerUserId: ownerUser.id,
        mode: 'direct',
        planId,
        trialDays,
        ownerTcAuditRef: tcAuditRef(adminTcKimlik),
      },
    })

    // Hoş geldiniz maili — sadece gerçek e-posta varsa gönder
    let welcomeEmailSent = false
    if (adminEmail) {
      try {
        await sendStaffWelcomeEmail({
          to: adminEmail,
          staffName: `${ownerUser.firstName} ${ownerUser.lastName}`,
          organizationName: orgData.name,
          brandColor: null,
          tempPassword: effectivePassword,
          loginUrl: `${getOrgUrl(hospital.slug)}/auth/login`,
        })
        welcomeEmailSent = true
      } catch (err) {
        logger.warn('hospital-create', `Hoş geldiniz maili gönderilemedi: ${adminEmail}`, err instanceof Error ? err.message : err)
      }
    }

    return jsonResponse({
      ...hospital,
      ownerUserId: ownerUser.id,
      mode: 'direct',
      emailSent: welcomeEmailSent,
      // Geçici şifre — super admin elden teslim için her durumda dön
      tempPassword: effectivePassword,
      // TC echo — frontend PDF üretimi için
      adminTcKimlik,
    }, 201)
  }

  // ── INVITE MODE — Davet linki gönder, esas yönetici email'den şifresini kurar ──
  // adminEmail, superRefine ile invite modda zorunlu kılındığı için burada her zaman tanımlı.
  const inviteEmail = adminEmail!
  const { raw, hash } = generateInvitationToken()
  const expiresAt = computeInvitationExpiry()

  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: hash,
      email: inviteEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      phone: null,
      title: null,
      role: 'admin',
      organizationId: hospital.id,
      invitedByUserId: dbUser.id,
      setAsOwner: true,
      expiresAt,
      tcEncrypted: encryptTcKimlik(adminTcKimlik),
      tcHash: hashTcKimlik(adminTcKimlik),
    },
    select: { id: true },
  })

  await audit({
    action: 'create',
    entityType: 'organization',
    entityId: hospital.id,
    newData: {
      hospitalName: orgData.name,
      hospitalCode: orgData.code,
      adminEmail,
      invitationId: invitation.id,
      mode: 'invite',
      planId,
      trialDays,
      ownerTcAuditRef: tcAuditRef(adminTcKimlik),
    },
  })

  // Davet linki tenant subdomain'ine gönderilir — accept sonrası kullanıcı
  // doğrudan kendi hastanesinin admin panel'ine yönlenir.
  const inviteUrl = buildInvitationUrl(getOrgUrl(hospital.slug), raw)
  let emailSent = true
  try {
    emailSent = await sendInvitationEmail({
      to: inviteEmail,
      organizationName: orgData.name,
      inviteUrl,
      inviterName: `${dbUser.firstName} ${dbUser.lastName}`,
      recipientName: `${adminFirstName} ${adminLastName}`,
      roleLabel: 'Esas Yönetici',
      expiresInHours: INVITATION_TTL_HOURS,
      organizationId: null,
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
    mode: 'invite',
    invitationId: invitation.id,
    invitationExpiresAt: expiresAt,
    emailSent,
    ...(emailSent ? {} : { inviteUrl }),
  }, 201)
})
