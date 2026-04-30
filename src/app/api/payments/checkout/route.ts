import { prisma } from '@/lib/prisma'
import { jsonResponse, errorResponse, parseBody } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { createCheckoutForm } from '@/lib/iyzico'
import { logger } from '@/lib/logger'

/**
 * POST /api/payments/checkout
 * Iyzico checkout form başlatır — admin abonelik ödemesi için
 * Body: { planId: string, billingCycle: 'monthly' | 'annual' }
 */
export const POST = withAdminRoute(async ({ request, dbUser, organizationId, audit }) => {
  const body = await parseBody<{ planId: string; billingCycle: 'monthly' | 'annual' }>(request)
  if (!body?.planId || !body?.billingCycle) {
    return errorResponse('planId ve billingCycle zorunlu')
  }

  const orgId = organizationId

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.planId } })
  if (!plan || !plan.isActive) return errorResponse('Plan bulunamadı', 404)

  const price = body.billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly
  if (!price || Number(price) <= 0) return errorResponse('Bu plan için fiyat tanımlanmamış')

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return errorResponse('Organizasyon bulunamadı', 404)

  const subscription = await prisma.organizationSubscription.findUnique({ where: { organizationId: orgId } })
  if (!subscription) return errorResponse('Aktif abonelik bulunamadı. Lütfen önce bir plan seçiniz.', 404)

  const conversationId = `SUB-${orgId.slice(0, 8)}-${Date.now()}`

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
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
        id: dbUser.id,
        name: dbUser.firstName,
        surname: dbUser.lastName,
        email: dbUser.email,
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
          name: `${plan.name} - ${body.billingCycle === 'annual' ? 'Yıllık' : 'Aylık'}`,
          category1: 'SaaS Abonelik',
          itemType: 'VIRTUAL',
          price: Number(price).toFixed(2),
        },
      ],
    })

    await audit({
      action: 'payment.checkout.start',
      entityType: 'payment',
      entityId: payment.id,
      newData: { planId: plan.id, billingCycle: body.billingCycle, amount: Number(price) },
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
    return errorResponse('Ödeme formu oluşturulamadı. Lütfen tekrar deneyin.')
  }
}, { requireOrganization: true, strict: true })
