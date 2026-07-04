import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { checkRateLimit } from '@/lib/redis'
import { sendEmail } from '@/lib/email'
import { BRAND } from '@/lib/brand'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/** Simple email validation */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Escapes HTML to prevent injection in email templates */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * POST /api/public/demo-request
 * Public endpoint — no auth required.
 * Rate limited: 3 requests per hour per IP.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting — IP based, 3 requests/hour ──
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `demo-request:${ip}`

    const allowed = await checkRateLimit(rateLimitKey, 3, 3600)
    if (!allowed) {
      return errorResponse(
        'Cok fazla istek gonderdiniz. Lutfen bir saat sonra tekrar deneyin.',
        429
      )
    }

    // ── Parse and validate body ──
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return errorResponse('Gecersiz istek formati.', 400)
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      organizationName,
      staffCount,
      message,
    } = body as {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      organizationName?: string
      staffCount?: string
      message?: string
    }

    // Required fields
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
      return errorResponse('Ad alani zorunludur (en az 2 karakter).', 400)
    }
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 1) {
      return errorResponse('Soyad alani zorunludur.', 400)
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return errorResponse('Gecerli bir e-posta adresi giriniz.', 400)
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 5) {
      return errorResponse('Telefon alani zorunludur.', 400)
    }
    if (!organizationName || typeof organizationName !== 'string' || organizationName.trim().length < 2) {
      return errorResponse('Hastane adi zorunludur.', 400)
    }
    if (!staffCount || typeof staffCount !== 'string') {
      return errorResponse('Personel sayisi zorunludur.', 400)
    }

    // Sanitize
    const sanitized = {
      firstName: escapeHtml(firstName.trim().slice(0, 100)),
      lastName: escapeHtml(lastName.trim().slice(0, 100)),
      email: email.trim().toLowerCase().slice(0, 200),
      phone: escapeHtml(phone.trim().slice(0, 30)),
      organizationName: escapeHtml(organizationName.trim().slice(0, 200)),
      staffCount: escapeHtml(staffCount.trim().slice(0, 20)),
      message: message ? escapeHtml(message.trim().slice(0, 1000)) : '',
    }

    // ── Kalıcı kayıt (e-postadan BAĞIMSIZ) — mesaj asla kaybolmaz ──
    // İletişim formu, message'ı "[ILETISIM FORMU] ..." önekiyle gönderir; demo
    // formu düz gönderir. Kaynağı buradan ayırıp super-admin panelde gösteriyoruz.
    const isContactForm =
      typeof message === 'string' && message.trim().startsWith('[ILETISIM FORMU]')
    const cleanMessage = isContactForm
      ? message!.trim().replace(/^\[ILETISIM FORMU\]\s*/, '')
      : (message?.trim() ?? '')
    const composedName =
      lastName && lastName.trim() && lastName.trim() !== '-'
        ? `${firstName.trim()} ${lastName.trim()}`
        : firstName.trim()
    const cleanPhone = phone && phone.trim() !== '-' ? phone.trim().slice(0, 30) : null
    const cleanStaff = staffCount && staffCount.trim() !== '-' ? staffCount.trim().slice(0, 20) : null

    try {
      await prisma.contactMessage.create({
        data: {
          source: isContactForm ? 'contact' : 'demo',
          name: composedName.slice(0, 200),
          email: sanitized.email, // trim + lowercase edilmiş
          phone: cleanPhone,
          organization: isContactForm ? null : organizationName.trim().slice(0, 200),
          staffCount: cleanStaff,
          subject: isContactForm ? organizationName.trim().slice(0, 300) : null,
          message: cleanMessage.slice(0, 1000) || null,
          ipAddress: ip.slice(0, 45),
        },
      })
    } catch (err) {
      // Kayıt başarısız olsa bile kullanıcıya hata döndürme — e-posta backstop var.
      logger.error('demo-request', 'İletişim mesajı DB kaydı başarısız', { err })
    }

    // ── Send notification email to admin ──
    // ADMIN_ALERT_EMAIL boşsa destek adresine düş — sessiz kayıp olmasın.
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || BRAND.supportEmail
    if (adminEmail) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `[${BRAND.fullName}] Yeni Demo Talebi - ${sanitized.organizationName}`,
          html: `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: linear-gradient(135deg, #0d9668, #065f46); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h1 style="color: white; font-size: 20px; margin: 0;">Yeni Demo Talebi</h1>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 8px 0 0;">${BRAND.fullName} platformundan yeni bir demo talebi alindi.</p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #475569; width: 140px;">Ad Soyad</td>
                  <td style="padding: 12px 0; color: #0f172a;">${sanitized.firstName} ${sanitized.lastName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #475569;">E-posta</td>
                  <td style="padding: 12px 0; color: #0f172a;"><a href="mailto:${sanitized.email}" style="color: #0d9668;">${sanitized.email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #475569;">Telefon</td>
                  <td style="padding: 12px 0; color: #0f172a;">${sanitized.phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #475569;">Hastane</td>
                  <td style="padding: 12px 0; color: #0f172a;">${sanitized.organizationName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 0; font-weight: 600; color: #475569;">Personel Sayisi</td>
                  <td style="padding: 12px 0; color: #0f172a;">${sanitized.staffCount}</td>
                </tr>
                ${sanitized.message ? `
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #475569; vertical-align: top;">Mesaj</td>
                  <td style="padding: 12px 0; color: #0f172a;">${sanitized.message}</td>
                </tr>
                ` : ''}
              </table>
              <div style="margin-top: 24px; padding: 16px; background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b;">
                IP: ${ip} | Tarih: ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
              </div>
            </div>
          `,
        })
      } catch {
        // Email failure should not block the response
        logger.error('demo-request', 'Demo request email failed to send')
      }
    }

    return jsonResponse({
      success: true,
      message: 'Demo talebiniz basariyla alindi. En kisa surede sizinle iletisime gececegiz.',
    })
  } catch {
    return errorResponse('Beklenmeyen bir hata olustu. Lutfen tekrar deneyin.', 500)
  }
}
