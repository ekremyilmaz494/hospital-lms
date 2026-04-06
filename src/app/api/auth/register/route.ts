import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { selfRegisterSchema } from '@/lib/validations'
import { sendSelfRegistrationEmail } from '@/lib/email'

export async function POST(request: Request) {
  // Rate limiting — IP bazlı: 3 istek / saat
  const clientIp =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  const ipAllowed = await checkRateLimit(`register:ip:${clientIp}`, 3, 3600)
  if (!ipAllowed) return errorResponse('Çok fazla kayıt denemesi. Lütfen bir saat sonra tekrar deneyin.', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = selfRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const { hospitalName, hospitalCode, address, phone, firstName, lastName, email, password } = parsed.data

  // Email bazlı rate limit: 1 istek / 24 saat
  const emailAllowed = await checkRateLimit(`register:email:${email.toLowerCase()}`, 1, 86400)
  if (!emailAllowed) return errorResponse('Bu e-posta ile son 24 saat içinde kayıt denemesi yapılmış. Lütfen daha sonra tekrar deneyin.', 429)

  // Kod ve email benzersizlik kontrolleri — paralel
  const [existingOrg, existingUser] = await Promise.all([
    prisma.organization.findUnique({ where: { code: hospitalCode } }),
    prisma.user.findUnique({ where: { email } }),
  ])

  if (existingOrg) return errorResponse('Bu hastane kodu zaten kullanılıyor')
  if (existingUser) return errorResponse('Bu e-posta adresi zaten kayıtlı')

  // En ucuz aktif planı bul (trial için)
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { priceMonthly: 'asc' },
  })
  if (!plan) return errorResponse('Abonelik planı bulunamadı')

  let org
  try {
    // Organization oluştur — setupCompleted: false
    org = await prisma.organization.create({
      data: {
        name: hospitalName,
        code: hospitalCode,
        address: address || null,
        phone: phone || null,
        email,
        setupCompleted: false,
      },
    })

    // 30 günlük trial abonelik
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 30)

    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'trial',
        trialEndsAt,
        billingCycle: 'monthly',
      },
    })

    // Supabase Auth kullanıcı oluştur — email doğrulama gerektirir
    const supabase = await createServiceClient()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Kullanıcı e-postasını doğrulamalı
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        organization_id: org.id,
      },
    })

    if (authError) {
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => {})
      logger.error('Register', 'Supabase auth hatasi', authError.message)
      return errorResponse('Kullanıcı oluşturulamadı. Lütfen farklı bir e-posta deneyin.')
    }

    // Prisma User kaydı
    await prisma.user.create({
      data: {
        id: authUser.user.id,
        email,
        firstName,
        lastName,
        role: 'admin',
        organizationId: org.id,
      },
    })

    // Audit log
    await createAuditLog({
      userId: authUser.user.id,
      organizationId: org.id,
      action: 'self_register',
      entityType: 'organization',
      entityId: org.id,
      newData: { hospitalName, hospitalCode, email },
      request,
    })

    // Hoş geldiniz e-postası (arka planda, hata kayıt akışını engellemesin)
    sendSelfRegistrationEmail({
      to: email,
      adminName: `${firstName} ${lastName}`,
      hospitalName,
    }).catch((err) => {
      logger.error('Register', 'Hos geldiniz e-postasi gonderilemedi', (err as Error).message)
    })

    logger.info('Register', 'Yeni hastane kaydi (self-service)', { orgId: org.id, hospitalName, email })

    return jsonResponse({
      success: true,
      message: 'Hastane başarıyla oluşturuldu. Lütfen e-postanızı kontrol ederek hesabınızı doğrulayın.',
    }, 201)
  } catch (err) {
    if (org) await prisma.organization.delete({ where: { id: org.id } }).catch(() => {})
    logger.error('Register', 'Kayit hatasi', (err as Error).message)
    return errorResponse('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.')
  }
}
