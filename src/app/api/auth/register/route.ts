import { prisma } from '@/lib/prisma'
import { createServiceClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { z } from 'zod'

const registerSchema = z.object({
  hospitalName: z.string().min(2).max(255),
  hospitalCode: z.string().min(2).max(50).regex(/^[a-zA-Z0-9-]+$/),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
  planSlug: z.string().optional(),
})

export async function POST(request: Request) {
  const body = await parseBody(request)
  if (!body) return errorResponse('Gecersiz istek verisi')

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues.map(i => i.message).join(', '))
  }

  const { hospitalName, hospitalCode, adminEmail, adminPassword, adminFirstName, adminLastName, planSlug } = parsed.data

  // Kod benzersizliği
  const existingOrg = await prisma.organization.findUnique({ where: { code: hospitalCode } })
  if (existingOrg) return errorResponse('Bu hastane kodu zaten kullaniliyor')

  // Email benzersizliği
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (existingUser) return errorResponse('Bu e-posta adresi zaten kayitli')

  // Plan bul
  const plan = planSlug
    ? await prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } })
    : await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })

  if (!plan) return errorResponse('Abonelik plani bulunamadi')

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
      return errorResponse('Kullanici olusturulamadi. Lutfen farkli bir e-posta deneyin.')
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
      message: 'Hastane basariyla olusturuldu. 14 gunluk deneme suresi baslamistir.',
      redirectUrl: '/auth/login',
    }, 201)
  } catch (err) {
    // Rollback
    if (org) await prisma.organization.delete({ where: { id: org.id } }).catch(() => {})
    logger.error('Register', 'Kayit hatasi', (err as Error).message)
    return errorResponse('Kayit sirasinda bir hata olustu. Lutfen tekrar deneyin.')
  }
}
