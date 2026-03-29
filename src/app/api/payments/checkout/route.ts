import { prisma } from '@/lib/prisma'
import { getAuthUser, requireRole, jsonResponse, errorResponse, parseBody, createAuditLog } from '@/lib/api-helpers'
import { createCheckoutForm } from '@/lib/iyzico'
import { logger } from '@/lib/logger'

/**
 * POST /api/payments/checkout
 * Iyzico checkout form başlatır — admin abonelik ödemesi için
 * Body: { planId: string, billingCycle: 'monthly' | 'annual' }
 */
export async function POST(request: Request) {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  const body = await parseBody<{ planId: string; billingCycle: 'monthly' | 'annual' }>(request)
  if (!body?.planId || !body?.billingCycle) {
    return errorResponse('planId ve billingCycle zorunlu')
  }

  const orgId = dbUser!.organizationId!

  // Plan bilgilerini al
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.planId } })
  if (!plan || !plan.isActive) return errorResponse('Plan bulunamadi', 404)

  const price = body.billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly
  if (!price || Number(price) <= 0) return errorResponse('Bu plan icin fiyat tanimlanmamis')

  // Organization bilgileri
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return errorResponse('Organizasyon bulunamadi', 404)

  const conversationId = `SUB-${orgId.slice(0, 8)}-${Date.now()}`

  // Ödeme kaydı oluştur (pending)
  const payment = await prisma.payment.create({
    data: {
      subscriptionId: (await prisma.organizationSubscription.findUnique({ where: { organizationId: orgId } }))?.id ?? '',
      organizationId: orgId,
      amount: price,
      currency: 'TRY',
      status: 'pending',
      paymentMethod: 'credit_card',
      iyzicoConversationId: conversationId,
    },
  })

  try {
    const result = await createCheckoutForm({
      locale: 'tr',
      conversationId,
      price: Number(price).toFixed(2),
      paidPrice: Number(price).toFixed(2),
      currency: 'TRY',
      basketId: payment.id,
      paymentGroup: 'SUBSCRIPTION',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
      enabledInstallments: [1, 2, 3, 6],
      buyer: {
        id: dbUser!.id,
        name: dbUser!.firstName,
        surname: dbUser!.lastName,
        email: dbUser!.email,
        identityNumber: '11111111111',
        registrationAddress: org.address ?? 'Turkiye',
        ip: request.headers.get('x-forwarded-for') ?? '127.0.0.1',
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: org.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: org.address ?? 'Turkiye',
      },
      billingAddress: {
        contactName: org.name,
        city: 'Istanbul',
        country: 'Turkey',
        address: org.address ?? 'Turkiye',
      },
      basketItems: [
        {
          id: plan.id,
          name: `${plan.name} - ${body.billingCycle === 'annual' ? 'Yillik' : 'Aylik'}`,
          category1: 'SaaS Abonelik',
          itemType: 'VIRTUAL',
          price: Number(price).toFixed(2),
        },
      ],
    })

    await createAuditLog({
      userId: dbUser!.id,
      organizationId: orgId,
      action: 'payment.checkout.start',
      entityType: 'payment',
      entityId: payment.id,
      newData: { planId: plan.id, billingCycle: body.billingCycle, amount: Number(price) },
      request,
    })

    return jsonResponse({
      checkoutFormContent: result.checkoutFormContent,
      token: result.token,
      paymentId: payment.id,
    })
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', errorMessage: (err as Error).message },
    })
    logger.error('Payment Checkout', 'Iyzico checkout baslatilamadi', (err as Error).message)
    return errorResponse('Odeme formu olusturulamadi. Lutfen tekrar deneyin.')
  }
}
