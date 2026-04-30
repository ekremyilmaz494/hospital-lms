import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody, safePagination, getAppUrl } from '@/lib/api-helpers'
import { withSuperAdminRoute } from '@/lib/api-handler'
import { createHospitalWithAdminSchema } from '@/lib/validations'
import { sendHospitalWelcomeEmail } from '@/lib/email'
import { TRAINING_CATEGORIES } from '@/lib/training-categories'
import { slugify } from '@/lib/organization'
import { createAuthUser, AuthUserError, DbUserError } from '@/lib/auth-user-factory'
import { logger } from '@/lib/logger'

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

export const POST = withSuperAdminRoute(async ({ request, dbUser, audit }) => {
  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek gövdesi')

  const parsed = createHospitalWithAdminSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const { adminFirstName, adminLastName, adminEmail, adminPassword, planId, trialDays, ...orgData } = parsed.data

  // Hastane kodu benzersiz mi?
  const existing = await prisma.organization.findUnique({ where: { code: orgData.code } })
  if (existing) return errorResponse('Bu kod zaten kullanılıyor', 409)

  // Slug oluştur (hastane adından otomatik) ve benzersiz yap
  let slug = slugify(orgData.name)
  if (slug.length < 3) slug = slugify(orgData.code)

  // Slug benzersizlik kontrolü — çakışma varsa sonuna sayı ekle
  let slugCandidate = slug
  let slugSuffix = 1
  while (await prisma.organization.findUnique({ where: { slug: slugCandidate } })) {
    slugCandidate = `${slug}-${slugSuffix}`
    slugSuffix++
  }
  slug = slugCandidate

  // Admin e-posta benzersiz mi?
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingUser) return errorResponse('Bu e-posta adresi zaten kullanılıyor', 409)

  // Plan doğrulama
  if (planId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan) return errorResponse('Belirtilen abonelik planı bulunamadı', 404)
  }

  // Geçici şifre oluştur (form'dan gönderilmezse otomatik üret)
  const tempPassword = adminPassword || crypto.randomBytes(12).toString('base64url')

  // 1) Transaction: Organizasyon + Abonelik + Kategoriler (user HARIC)
  const hospital = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        ...orgData,
        slug,
        setupCompleted: false,
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

  // 2) Auth + DB user oluştur (factory ile rollback dahil)
  let authResult
  try {
    authResult = await createAuthUser({
      email: adminEmail,
      password: tempPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'admin',
      organizationId: hospital.id,
      mustChangePassword: !adminPassword,
    })
  } catch (err) {
    // Auth veya DB basarisiz → org'u sil
    await prisma.organization.delete({ where: { id: hospital.id } }).catch(() => {})
    if (err instanceof AuthUserError) {
      const safeMsg = err.message.includes('already registered')
        ? 'Bu e-posta adresi Supabase Auth sisteminde zaten kayıtlı'
        : 'Kullanıcı oluşturulamadı. Lütfen tekrar deneyin.'
      return errorResponse(safeMsg, 400)
    }
    if (err instanceof DbUserError) {
      return errorResponse(err.safeMessage)
    }
    throw err
  }

  // Audit log
  await audit({
    action: 'create',
    entityType: 'organization',
    entityId: hospital.id,
    newData: {
      hospitalName: orgData.name,
      hospitalCode: orgData.code,
      adminEmail,
      planId,
      trialDays,
    },
  })

  // Hoş geldiniz e-postası gönder
  const loginUrl = `${getAppUrl()}/auth/login`
  let emailSent = true
  try {
    await sendHospitalWelcomeEmail({
      to: adminEmail,
      hospitalName: orgData.name,
      loginUrl,
      tempPassword,
      adminName: `${adminFirstName} ${adminLastName}`,
    })
  } catch (emailErr) {
    emailSent = false
    logger.error('hospital-create', 'Welcome email failed', { adminEmail, error: (emailErr as Error).message })
  }

  return jsonResponse({
    ...hospital,
    emailSent,
    // Email başarısızsa şifreyi response'da göster (admin UI'da modal ile gösterilecek)
    ...(!emailSent ? { tempPassword } : {}),
  }, 201)
})
