import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { verifySnsMessage, isAllowedSnsUrl } from '@/lib/aws-sns'

/**
 * SES → SNS → bu webhook
 *
 * AWS SES bounce/complaint event'lerini bir SNS topic'e gönderir; SNS de bu URL'yi
 * çağırır. İki tip mesaj gelir:
 *
 * 1. **SubscriptionConfirmation** — topic'e ilk subscribe olunduğunda gelir;
 *    `SubscribeURL`'i fetch ederek subscription'ı confirm ederiz.
 *
 * 2. **Notification** — gerçek bounce/complaint event'i.
 *
 * GÜVENLİK: Her mesaj işlenmeden ÖNCE SNS imzası kriptografik doğrulanır
 * (`verifySnsMessage`). Doğrulanmamış mesaj reddedilir — bu, SubscribeURL üzerinden
 * SSRF'i ve sahte bounce/complaint enjeksiyonunu engeller. SubscribeURL ayrıca
 * fetch edilmeden önce host whitelist'ten (sns.*.amazonaws.com + https) geçirilir.
 */

/** Log injection (CRLF) önlemek için kullanıcı-etkili string'leri tek satıra indirger. */
function sanitizeForLog(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

export async function POST(request: Request) {
  try {
    const text = await request.text()
    const body = JSON.parse(text) as Record<string, unknown>
    const messageType = (request.headers.get('x-amz-sns-message-type') ?? body.Type) as string | undefined

    // ── İmza doğrulaması (KRİTİK) — herhangi bir işlemden önce ──
    const verified = await verifySnsMessage(body)
    if (!verified) {
      logger.warn('ses-webhook', 'SNS imzası doğrulanamadı — istek reddedildi')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    if (messageType === 'SubscriptionConfirmation') {
      const subscribeUrl = body.SubscribeURL as string | undefined
      // İmza geçse bile SubscribeURL host'unu yeniden doğrula (defense-in-depth SSRF guard).
      if (!isAllowedSnsUrl(subscribeUrl)) {
        logger.warn('ses-webhook', 'Geçersiz SubscribeURL host — fetch atlandı')
        return NextResponse.json({ error: 'Invalid SubscribeURL' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
      }
      // Auto-confirm: SNS'in subscribe link'ini bir kez fetch et (artık doğrulanmış kaynak)
      const res = await fetch(subscribeUrl as string, { method: 'GET' })
      logger.info('ses-webhook', `SNS subscription confirmed (status=${res.status})`)
      return NextResponse.json({ ok: true, confirmed: true }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (messageType === 'Notification') {
      // Message field'ı string-encoded JSON
      const inner = typeof body.Message === 'string' ? JSON.parse(body.Message) : body.Message
      const eventType = inner?.eventType ?? inner?.notificationType
      const mailMeta = inner?.mail ?? {}
      const recipients = Array.isArray(mailMeta?.destination)
        ? mailMeta.destination.map(sanitizeForLog).join(',')
        : ''

      if (eventType === 'Bounce') {
        const bounceType = sanitizeForLog(inner?.bounce?.bounceType)
        const bouncedRecipients = inner?.bounce?.bouncedRecipients ?? []
        logger.warn('ses-webhook', `SES bounce — type=${bounceType} count=${bouncedRecipients.length} recipients=${recipients}`)
      } else if (eventType === 'Complaint') {
        logger.warn('ses-webhook', `SES complaint — recipients=${recipients}`)
      } else {
        logger.info('ses-webhook', `SES event=${sanitizeForLog(eventType)} recipients=${recipients}`)
      }
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    }

    logger.warn('ses-webhook', `Bilinmeyen SNS message type: ${sanitizeForLog(messageType)}`)
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
