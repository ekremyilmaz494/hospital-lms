import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { z } from 'zod'

const registerSchema = z.object({
  hospitalName: z.string().min(2).max(255),
  hospitalCode: z.string().min(2).max(50).regex(/^[a-zA-Z0-9-]+$/),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    'Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir'
  ),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
  planSlug: z.string().optional(),
})

export async function POST(request: Request) {
  // Rate limiting — IP bazlı
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const allowed = await checkRateLimit(`register:${clientIp}`, 5, 3600)
  if (!allowed) return errorResponse('Çok fazla kayıt denemesi. Lütfen bir saat sonra tekrar deneyin.', 429)

  const body = await parseBody(request)
  if (!body) return errorResponse('Geçersiz istek verisi')

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const { hospitalName, hospitalCode, adminEmail, adminPassword, adminFirstName, adminLastName, planSlug } = parsed.data

  // Email bazlı rate limit
  const emailAllowed = await checkRateLimit(`register:${adminEmail.toLowerCase()}`, 3, 3600)
  if (!emailAllowed) return errorResponse('Bu e-posta ile çok fazla kayıt denemesi yapıldı.', 429)

  // Kod benzersizliği
  const existingOrg = await prisma.organization.findUnique({ where: { code: hospitalCode } })
  if (existingOrg) return errorResponse('Bu hastane kodu zaten kullanılıyor')

  // Email benzersizliği
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingUser) return errorResponse('Bu e-posta adresi zaten kayıtlı')

  // Plan bul
  const plan = planSlug
    ? await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
    : await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })

  if (!plan) return errorResponse('Abonelik planı bulunamadı')

  let org
  try {
    // Organization oluştur
    org = await prisma.organization.create({
      data: {
        name: hospitalName,
        code: hospitalCode,
        email: adminEmail,
      },
    })

    // Trial abonelik
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    await prisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: 'trial',
        trialEndsAt,
        billingCycle: 'monthly',
      },
    })

    // Admin kullanıcı oluştur
    const supabase = await createServiceClient()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'admin',
        organization_id: org.id,
      },
    })

    if (authError) {
      // Rollback org
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => {})
      logger.error('Register', 'Supabase auth hatasi', authError.message)
      return errorResponse('Kullanıcı oluşturulamadı. Lütfen farklı bir e-posta deneyin.')
    }

    await prisma.user.create({
      data: {
        id: authUser.user.id,
        email: adminEmail,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'admin',
        organizationId: org.id,
      },
    })

    logger.info('Register', 'Yeni hastane kaydi', { orgId: org.id, hospitalName, adminEmail })

    return jsonResponse({
      success: true,
      message: 'Hastane başarıyla oluşturuldu. 14 günlük deneme süresi başlamıştır.',
      redirectUrl: '/auth/login',
    }, 201)
  } catch (err) {
    // Rollback
    if (org) await prisma.organization.delete({ where: { id: org.id } }).catch(() => {})
    logger.error('Register', 'Kayit hatasi', (err as Error).message)
    return errorResponse('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.')
  }
}
