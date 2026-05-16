import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * SES → SNS → bu webhook
 *
 * AWS SES bounce/complaint event'lerini bir SNS topic'e gönderir; SNS de bu URL'yi
 * çağırır. İki tip mesaj gelir:
 *
 * 1. **SubscriptionConfirmation** — topic'e ilk subscribe olunduğunda gelir;
 *    `SubscribeURL`'i fetch ederek subscription'ı confirm ederiz.
 *
 * 2. **Notification** — gerçek bounce/complaint event'i. Şu an sadece loglanıyor;
 *    ileride bounce'larda kullanıcının emailEnabled'ını otomatik kapatacağız
 *    (deliverability skoru düşmesin).
 *
 * Auth: SNS HMAC imza doğrulamasını şu an yapmıyoruz (signature header'ları var
 * ama parsing AWS SDK gerektiriyor). Production access onaylanmadan önce bunu
 * sıkılaştır — `aws-sns-validator` veya manuel certificate fetch.
 */
export async function POST(request: Request) {
  try {
    const text = await request.text()
    const body = JSON.parse(text) as Record<string, unknown>
    const messageType = (request.headers.get('x-amz-sns-message-type') ?? body.Type) as string | undefined

    if (messageType === 'SubscriptionConfirmation') {
      const subscribeUrl = body.SubscribeURL as string | undefined
      if (!subscribeUrl) {
        return NextResponse.json({ error: 'SubscribeURL eksik' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
      }
      // Auto-confirm: SNS'in subscribe link'ini bir kez fetch et
      const res = await fetch(subscribeUrl, { method: 'GET' })
      logger.info('ses-webhook', `SNS subscription confirmed (status=${res.status})`)
      return NextResponse.json({ ok: true, confirmed: true }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (messageType === 'Notification') {
      // Message field'ı string-encoded JSON
      const inner = typeof body.Message === 'string' ? JSON.parse(body.Message) : body.Message
      const eventType = inner?.eventType ?? inner?.notificationType
      const mailMeta = inner?.mail ?? {}
      const recipients = Array.isArray(mailMeta?.destination) ? mailMeta.destination : []

      if (eventType === 'Bounce') {
        const bounceType = inner?.bounce?.bounceType
        const bouncedRecipients = inner?.bounce?.bouncedRecipients ?? []
        logger.warn('ses-webhook', `SES bounce — type=${bounceType} count=${bouncedRecipients.length} recipients=${recipients.join(',')}`)
      } else if (eventType === 'Complaint') {
        logger.warn('ses-webhook', `SES complaint — recipients=${recipients.join(',')}`)
      } else {
        logger.info('ses-webhook', `SES event=${eventType} recipients=${recipients.join(',')}`)
      }
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    }

    logger.warn('ses-webhook', `Bilinmeyen SNS message type: ${messageType}`)
    return NextResponse.json({ ok: true, ignored: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    logger.error('ses-webhook', 'SNS body parse hatası', err)
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
}

/** Health check / SNS'in HTTP HEAD probe'u için. */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'ses-webhook' }, { headers: { 'Cache-Control': 'no-store' } })
}
