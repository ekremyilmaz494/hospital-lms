import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import { sendEmail, escapeHtml } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import { BRAND } from '@/lib/brand'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'

const testSchema = z.object({
  to: z.string().email('Geçerli bir e-posta adresi girin'),
  // Form'daki yeni değerleri preview için kullan; verilmezse DB'deki kayıtlı değer.
  emailDisplayName: z.string().trim().max(100).optional().nullable(),
  emailReplyTo: z.string().trim().max(320).optional().nullable(),
})

/**
 * POST — SES test e-postası gönderir.
 * - Org başına saatte 10 test (spam koruması)
 * - `transactional: true` → emailEnabled=false olsa da gider (admin görsel test edebilsin)
 * - Form'da yazılı değer varsa kayıtsız preview yapar (kaydet'meden önce dene)
 */
export const POST = withAdminRoute(async ({ request, organizationId }) => {
  const rateOk = await checkRateLimit(`email-test:${organizationId}`, 10, 3600)
  if (!rateOk) {
    return errorResponse('Çok fazla test isteği. Lütfen bir saat sonra tekrar deneyin.', 429)
  }

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const parsed = testSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      emailDisplayName: true,
      emailReplyTo: true,
    },
  })

  // Form > DB fallback (kayıt öncesi preview)
  const previewDisplayName = parsed.data.emailDisplayName?.trim() || org?.emailDisplayName || org?.name || BRAND.fullName
  const previewReplyTo = parsed.data.emailReplyTo?.trim() || org?.emailReplyTo || undefined

  const subject = `${BRAND.name} · SMTP Test E-postası`
  const html = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${escapeHtml(previewDisplayName)}</h1>
        <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">E-posta Yapılandırma Testi</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
        <h2 style="color: #0f172a; margin: 0 0 12px; font-size: 18px;">Bağlantı başarılı</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 14px;">
          Bu bir test e-postasıdır. ${escapeHtml(BRAND.fullName)} merkezi e-posta altyapısı çalışıyor —
          personeline atanan eğitim bildirimleri <strong>${escapeHtml(previewDisplayName)}</strong> adına
          ${escapeHtml(BRAND.fromAddress)} adresinden gönderilecek.
        </p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 20px;">
          <p style="margin: 0; color: #166534; font-size: 13px;">
            ✓ Görünen ad: ${escapeHtml(previewDisplayName)}<br/>
            ✓ Yanıt adresi: ${escapeHtml(previewReplyTo ?? BRAND.supportEmail)}<br/>
            ✓ Gönderici: ${escapeHtml(BRAND.fromAddress)}
          </p>
        </div>
      </div>
    </div>
  `

  try {
    await sendEmail({
      to: parsed.data.to,
      subject,
      html,
      organizationId,
      fromName: previewDisplayName,
      replyTo: previewReplyTo,
      transactional: true, // Test her zaman gider — emailEnabled=false bypass
    })
    return jsonResponse({ ok: true, message: 'Test e-postası başarıyla gönderildi.' })
  } catch (err) {
    // Ham sağlayıcı (SES/Brevo) hata metni kullanıcıya sızdırılmaz — detay log'a,
    // kullanıcıya generic Türkçe mesaj (CLAUDE.md: iç/dış sistem detayı gösterme).
    logger.error('EmailTest', `SES test başarısız — org=${organizationId}`, err)
    return errorResponse('E-posta gönderilemedi. Lütfen e-posta adresini ve ayarları kontrol edin.', 400)
  }
}, { requireOrganization: true, strict: true })
