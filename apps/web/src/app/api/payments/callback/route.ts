import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyIyzicoCallback, retrieveCheckoutForm, generateInvoiceNumber } from '@/lib/iyzico'
import { logger } from '@/lib/logger'
import { isOnPrem } from '@/lib/deployment'

/**
 * POST /api/payments/callback
 * Iyzico'dan dönen ödeme sonucu — 3D Secure callback
 */
export async function POST(request: Request) {
  // On-prem dağıtımda ödeme/abonelik SaaS kavramıdır — lisans kullanılır.
  if (isOnPrem()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const formData = await request.formData()
  const token = formData.get('token') as string

  if (!token) {
    return NextResponse.redirect(new URL('/admin/settings?payment=error&msg=token_missing', process.env.NEXT_PUBLIC_APP_URL!))
  }

  try {
    // Önce Iyzico API'sine sorgu atarak ödemeyi sunucu taraflı doğrula
    // Callback verisine doğrudan güvenmek güvenlik açığıdır
    const verification = await verifyIyzicoCallback(token)
    if (verification.status !== 'success') {
      logger.warn('Payment Callback', 'Iyzico dogrulama basarisiz', { token: token.slice(0, 8) + '...' })
      return NextResponse.redirect(new URL('/admin/settings?payment=error&msg=verification_failed', process.env.NEXT_PUBLIC_APP_URL!))
    }

    // Doğrulama başarılı — detaylı bilgiyi al
    const result = await retrieveCheckoutForm(token)

    // Ödeme kaydını bul
    const payment = await prisma.payment.findFirst({
      where: { iyzicoConversationId: result.conversationId ?? undefined },
      include: { subscription: { include: { plan: true } } },
    })

    if (!payment) {
      logger.error('Payment Callback', 'Odeme kaydi bulunamadi', { conversationId: result.conversationId })
      return NextResponse.redirect(new URL('/admin/settings?payment=error&msg=not_found', process.env.NEXT_PUBLIC_APP_URL!))
    }

    if (result.paymentStatus === 'SUCCESS' && result.status === 'success') {
      // L28: iyzico'nun GERÇEKTEN TAHSİL ETTİĞİ tutarı, checkout'ta sunucunun kaydettiği
      // payment.amount ile doğrula. Önceki kod SUCCESS bayrağına güvenip tutarı hiç
      // karşılaştırmıyordu — kısmi/taksit/yanlış-basket veya manipüle tutar SUCCESS dönse
      // bile abonelik tam dönem aktive ediliyordu. Uyuşmazlıkta aktive ETME.
      const charged = typeof result.price === 'number' ? result.price : null
      const expected = Number(payment.amount)
      if (charged === null || !Number.isFinite(expected) || Math.abs(charged - expected) > 0.01) {
        logger.error('Payment Callback', 'Tahsil edilen tutar beklenenle uyuşmuyor — abonelik aktive edilmedi', {
          paymentId: payment.id,
          charged,
          expected,
        })
        return NextResponse.redirect(new URL('/admin/settings?payment=error&msg=amount_mismatch', process.env.NEXT_PUBLIC_APP_URL!))
      }

      // Ödeme başarılı
      const now = new Date()
      const billingCycle = payment.subscription.billingCycle
      const expiresAt = new Date(now)
      if (billingCycle === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      }

      // Transaction icinde fatura numarasi atayarak race condition onle
      const org = await prisma.organization.findUnique({ where: { id: payment.organizationId } })

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'paid',
            iyzicoPaymentId: result.paymentId ?? null,
            cardLastFour: result.lastFourDigits ?? null,
            cardBrand: result.cardAssociation ?? null,
            paidAt: now,
          },
        })

        await tx.organizationSubscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: 'active',
            startedAt: now,
            expiresAt,
            billingCycle: billingCycle ?? 'monthly',
          },
        })

        // Transaction icinde max invoice numarasini al (race condition yok)
        const lastInvoice = await tx.invoice.findFirst({
          orderBy: { issuedAt: 'desc' },
          select: { invoiceNumber: true },
        })
        const lastSeq = lastInvoice?.invoiceNumber
          ? parseInt(lastInvoice.invoiceNumber.split('-').pop() ?? '0', 10)
          : 0
        const nextInvoiceNumber = generateInvoiceNumber(lastSeq + 1)

        await tx.invoice.create({
          data: {
            paymentId: payment.id,
            subscriptionId: payment.subscriptionId,
            organizationId: payment.organizationId,
            invoiceNumber: nextInvoiceNumber,
            status: 'paid',
            amount: payment.amount,
            taxRate: 20,
            taxAmount: Number(payment.amount) * 0.20,
            totalAmount: Number(payment.amount) * 1.20,
            currency: 'TRY',
            billingName: org?.name ?? '',
            companyName: org?.name ?? null,
            periodStart: now,
            periodEnd: expiresAt,
            paidAt: now,
          },
        })
      })

      logger.info('Payment Callback', 'Odeme basarili', {
        paymentId: payment.id,
        iyzicoPaymentId: result.paymentId,
        amount: Number(payment.amount),
      })

      return NextResponse.redirect(new URL('/admin/settings?payment=success', process.env.NEXT_PUBLIC_APP_URL!))
    } else {
      // Ödeme başarısız
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          errorMessage: result.errorMessage ?? 'Ödeme başarısız',
        },
      })

      logger.warn('Payment Callback', 'Odeme basarisiz', {
        paymentId: payment.id,
        error: result.errorMessage,
      })

      return NextResponse.redirect(new URL(`/admin/settings?payment=error&msg=${encodeURIComponent(result.errorMessage ?? 'failed')}`, process.env.NEXT_PUBLIC_APP_URL!))
    }
  } catch (err) {
    logger.error('Payment Callback', 'Callback isleme hatasi', (err as Error).message)
    return NextResponse.redirect(new URL('/admin/settings?payment=error&msg=system_error', process.env.NEXT_PUBLIC_APP_URL!))
  }
}
