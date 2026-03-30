import nodemailer from 'nodemailer'
import { checkRateLimit } from '@/lib/redis'

/**
 * Escapes HTML special characters to prevent HTML injection in email templates.
 * Must be applied to all user-provided or database-sourced values before interpolation.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

// Rate limits: max 200 emails/hour globally, max 20/hour per recipient
const EMAIL_GLOBAL_LIMIT = 200
const EMAIL_PER_RECIPIENT_LIMIT = 20
const EMAIL_WINDOW_SECONDS = 3600

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const recipientList = Array.isArray(to) ? to : [to]

  // Global hourly cap — prevents runaway cron/bulk sends
  const globalOk = await checkRateLimit('email:global', EMAIL_GLOBAL_LIMIT, EMAIL_WINDOW_SECONDS)
  if (!globalOk) {
    throw new Error('Global e-posta rate limiti aşıldı (saatte 200). Lütfen daha sonra tekrar deneyin.')
  }

  // Per-recipient cap — prevents flooding a single address
  for (const recipient of recipientList) {
    const key = `email:recipient:${recipient.toLowerCase()}`
    const recipientOk = await checkRateLimit(key, EMAIL_PER_RECIPIENT_LIMIT, EMAIL_WINDOW_SECONDS)
    if (!recipientOk) {
      throw new Error(`"${recipient}" adresine saatte ${EMAIL_PER_RECIPIENT_LIMIT} e-postadan fazla gönderilemez.`)
    }
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Hastane LMS <noreply@hastanelms.com>',
    to: recipientList.join(', '),
    subject,
    html,
  })
}

// ── Email Templates ──

export function trainingAssignedEmail(staffName: string, trainingTitle: string, dueDate: string) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Yeni Eğitim Atandı</h2>
        <p style="color: #64748b;">Merhaba ${escapeHtml(staffName)},</p>
        <p style="color: #64748b;"><strong>"${escapeHtml(trainingTitle)}"</strong> eğitimi size atanmıştır.</p>
        <p style="color: #64748b;">Son tarih: <strong>${escapeHtml(dueDate)}</strong></p>
        <a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL ?? '')}/staff/my-trainings"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Eğitime Başla
        </a>
      </div>
    </div>
  `
}

export function examResultEmail(staffName: string, trainingTitle: string, score: number, passed: boolean) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Sınav Sonucu</h2>
        <p style="color: #64748b;">Merhaba ${escapeHtml(staffName)},</p>
        <p style="color: #64748b;"><strong>"${escapeHtml(trainingTitle)}"</strong> sınavınızın sonucu:</p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background: ${passed ? '#dcfce7' : '#fef2f2'}; border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 24px; font-weight: bold; color: ${passed ? '#16a34a' : '#dc2626'};">
            ${score}
          </div>
        </div>
        <p style="text-align: center; font-weight: bold; color: ${passed ? '#16a34a' : '#dc2626'};">
          ${passed ? 'Tebrikler, başarıyla geçtiniz!' : 'Maalesef geçemediniz.'}
        </p>
      </div>
    </div>
  `
}

export function forgotPasswordEmail(name: string, resetLink: string) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Şifre Sıfırlama</h2>
        <p style="color: #64748b;">Merhaba ${escapeHtml(name)},</p>
        <p style="color: #64748b;">Hesabınız için bir şifre sıfırlama isteği aldık. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
        <a href="${escapeHtml(resetLink)}"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Şifremi Sıfırla
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Bu link 1 saat içerisinde geçerliliğini yitirecektir. Eğer siz bu isteği yapmadıysanız bu e-postayı göz ardı edebilirsiniz.</p>
      </div>
    </div>
  `
}

export function welcomeEmail(name: string, email: string, resetLink: string) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hoş Geldiniz!</h2>
        <p style="color: #64748b;">Merhaba ${escapeHtml(name)},</p>
        <p style="color: #64748b;">Hastane LMS hesabınız oluşturulmuştur.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>E-posta:</strong> ${escapeHtml(email)}</p>
        </div>
        <p style="color: #64748b;">Hesabınıza erişim için aşağıdaki butona tıklayarak şifrenizi belirleyin:</p>
        <a href="${escapeHtml(resetLink)}"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Şifremi Belirle
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Bu link 24 saat içerisinde geçerliliğini yitirecektir.</p>
      </div>
    </div>
  `
}

// Yaklaşan eğitim deadline hatırlatması (3/1 gün kala)
export function upcomingTrainingReminderEmail(staffName: string, trainingTitle: string, dueDate: string, daysLeft: number) {
  const urgencyColor = daysLeft <= 1 ? '#dc2626' : '#f59e0b'
  const urgencyBg = daysLeft <= 1 ? '#fef2f2' : '#fffbeb'
  const urgencyLabel = daysLeft <= 1 ? 'SON GÜN! Yarın süresi doluyor' : daysLeft + ' gün kaldı'
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${urgencyColor}, ${daysLeft <= 1 ? '#7f1d1d' : '#92400e'}); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Eğitim Deadline Hatırlatması</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: bold; color: ${urgencyColor};">${urgencyLabel}</p>
        </div>
        <p style="color: #64748b;">Merhaba ${escapeHtml(staffName)},</p>
        <p style="color: #64748b;"><strong>"${escapeHtml(trainingTitle)}"</strong> eğitiminizin tamamlanma süresi yaklaşıyor.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>Eğitim:</strong> ${escapeHtml(trainingTitle)}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Son Tarih:</strong> ${escapeHtml(dueDate)}</p>
        </div>
        <p style="color: #64748b;">Lütfen zamanında tamamlayınız. Gecikme durumunda yöneticinize bildirim gidecektir.</p>
        <a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL ?? '')}/staff/my-trainings"
           style="display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Eğitime Git
        </a>
      </div>
    </div>
  `
}

// Sertifika sona erme hatırlatması (30/7 gün kala)
export function certificateExpiryReminderEmail(staffName: string, trainingTitle: string, expiryDate: string, daysLeft: number, renewLink: string) {
  const urgencyColor = daysLeft <= 7 ? '#dc2626' : '#f59e0b'
  const urgencyBg = daysLeft <= 7 ? '#fef2f2' : '#fffbeb'
  const urgencyLabel = daysLeft <= 7 ? 'KRİTİK — Son ' + daysLeft + ' gün!' : daysLeft + ' gün kaldı'
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, ${urgencyColor}, #7f1d1d); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Sertifika Yenileme Hatırlatması</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: bold; color: ${urgencyColor};">${urgencyLabel}</p>
        </div>
        <p style="color: #64748b;">Merhaba ${escapeHtml(staffName)},</p>
        <p style="color: #64748b;"><strong>"${escapeHtml(trainingTitle)}"</strong> eğitim sertifikanızın geçerlilik süresi dolmak üzere.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>Sertifika:</strong> ${escapeHtml(trainingTitle)}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Geçerlilik Tarihi:</strong> ${escapeHtml(expiryDate)}</p>
        </div>
        <p style="color: #64748b;">Sertifikanızın süresi dolmadan önce eğitimi tekrar tamamlamanız gerekmektedir.</p>
        <a href="${escapeHtml(renewLink)}"
           style="display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Eğitimi Yenile
        </a>
      </div>
    </div>
  `
}

// Gecikmiş eğitim hatırlatması (manuel veya otomatik)
export function overdueTrainingReminderEmail(staffName: string, trainingTitle: string, dueDate: string, daysOverdue: number) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc2626, #7f1d1d); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Gecikmiş Eğitim Uyarısı</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: bold; color: #dc2626;">${daysOverdue} gün gecikti!</p>
        </div>
        <p style="color: #64748b;">Merhaba ${escapeHtml(staffName)},</p>
        <p style="color: #64748b;"><strong>"${escapeHtml(trainingTitle)}"</strong> eğitiminiz ${escapeHtml(dueDate)} tarihinde tamamlanması gerekiyordu.</p>
        <p style="color: #64748b;">Lütfen en kısa sürede bu eğitimi tamamlayınız.</p>
        <a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL ?? '')}/staff/my-trainings"
           style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Eğitimi Tamamla
        </a>
      </div>
    </div>
  `
}
