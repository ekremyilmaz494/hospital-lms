import { jsonResponse, errorResponse } from '@/lib/api-helpers'
import { withAdminRoute } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { escapeHtml } from '@/lib/email'
import { checkRateLimit } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { z } from 'zod/v4'
import nodemailer from 'nodemailer'

const testSchema = z.object({
  // Canlı test — formdaki değerleri öncelikle kullan; boşsa DB'deki kayıtlı değer.
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpFrom: z.string().optional(),
  to: z.string().email('Geçerli bir e-posta adresi girin'),
})

/**
 * POST — SMTP canlı test.
 * Formdaki değerlerle (veya eksikse DB'dekiyle) gerçek bir test e-postası gönderir.
 * Save-öncesi test → yanlış config ile lock-out önlenir.
 */
export const POST = withAdminRoute(async ({ request, organizationId }) => {
  // Rate limit — aynı hastanenin test spam'ini engelle (saatte 10 test)
  const rateOk = await checkRateLimit(`smtp-test:${organizationId}`, 10, 3600)
  if (!rateOk) return errorResponse('Çok fazla test isteği. Lütfen bir saat sonra tekrar deneyin.', 429)

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Invalid body')

  const parsed = testSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.message)

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassEncrypted: true,
      smtpFrom: true,
    },
  })

  // Form > DB fallback
  const host = parsed.data.smtpHost || org?.smtpHost
  const port = parsed.data.smtpPort ?? org?.smtpPort ?? 587
  const secure = parsed.data.smtpSecure ?? org?.smtpSecure ?? false
  const user = parsed.data.smtpUser || org?.smtpUser

  let pass: string | undefined
  if (parsed.data.smtpPassword) {
    pass = parsed.data.smtpPassword
  } else if (org?.smtpPassEncrypted) {
    try { pass = decrypt(org.smtpPassEncrypted) } catch {
      return errorResponse('Kayıtlı SMTP şifresi çözülemedi. Lütfen şifreyi yeniden girin.', 400)
    }
  }

  if (!host || !user || !pass) {
    return errorResponse('Test için host, kullanıcı adı ve şifre zorunludur.', 400)
  }

  const from = parsed.data.smtpFrom || org?.smtpFrom || `${org?.name ?? 'Hastane LMS'} <${user}>`
  const hospitalName = org?.name ?? 'Hastane'

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  })

  try {
    await transporter.verify()
    await transporter.sendMail({
      from,
      to: parsed.data.to,
      subject: `${hospitalName} · SMTP Test E-postası`,
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">${escapeHtml(hospitalName)}</h1>
            <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">SMTP Konfigürasyon Testi</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="color: #0f172a; margin: 0 0 12px; font-size: 18px;">Bağlantı başarılı</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 14px;">
              Bu bir test e-postasıdır. SMTP yapılandırmanız doğru çalışıyor ve artık personele
              atanan eğitim bildirimleri <strong>${escapeHtml(hospitalName)}</strong> adına bu
              sunucudan gönderilecek.
            </p>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 20px;">
              <p style="margin: 0; color: #166534; font-size: 13px;">
                ✓ Host: ${escapeHtml(host)}:${port}<br/>
                ✓ Kullanıcı: ${escapeHtml(user)}<br/>
                ✓ Güvenli (SSL/TLS): ${secure ? 'Aktif' : 'STARTTLS'}
              </p>
            </div>
          </div>
        </div>
      `,
    })

    return jsonResponse({ ok: true, message: 'Test e-postası başarıyla gönderildi.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bilinmeyen hata'
    logger.error('SmtpTest', `SMTP test başarısız — org=${organizationId}`, err)
    return errorResponse(`SMTP bağlantısı başarısız: ${msg}`, 400)
  } finally {
    transporter.close()
  }
}, { requireOrganization: true, strict: true })
