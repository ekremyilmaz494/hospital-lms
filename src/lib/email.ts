import nodemailer from 'nodemailer'

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

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const recipients = Array.isArray(to) ? to.join(', ') : to

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Hastane LMS <noreply@hastanelms.com>',
    to: recipients,
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
        <h2 style="color: #1e293b; margin-top: 0;">Yeni Egitim Atandi</h2>
        <p style="color: #64748b;">Merhaba ${staffName},</p>
        <p style="color: #64748b;"><strong>"${trainingTitle}"</strong> egitimi size atanmistir.</p>
        <p style="color: #64748b;">Son tarih: <strong>${dueDate}</strong></p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/staff/my-trainings"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Egitime Basla
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
        <h2 style="color: #1e293b; margin-top: 0;">Sinav Sonucu</h2>
        <p style="color: #64748b;">Merhaba ${staffName},</p>
        <p style="color: #64748b;"><strong>"${trainingTitle}"</strong> sinavinizin sonucu:</p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background: ${passed ? '#dcfce7' : '#fef2f2'}; border-radius: 50%; width: 80px; height: 80px; line-height: 80px; font-size: 24px; font-weight: bold; color: ${passed ? '#16a34a' : '#dc2626'};">
            ${score}
          </div>
        </div>
        <p style="text-align: center; font-weight: bold; color: ${passed ? '#16a34a' : '#dc2626'};">
          ${passed ? 'Tebrikler, basariyla gectiniz!' : 'Maalesef gecemediniz.'}
        </p>
      </div>
    </div>
  `
}

export function welcomeEmail(name: string, email: string, tempPassword: string) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Hos Geldiniz!</h2>
        <p style="color: #64748b;">Merhaba ${name},</p>
        <p style="color: #64748b;">Hastane LMS hesabiniz olusturulmustur.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>E-posta:</strong> ${email}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Gecici Sifre:</strong> ${tempPassword}</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">Ilk girisinde sifrenizi degistirmeniz onemle tavsiye edilir.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Giris Yap
        </a>
      </div>
    </div>
  `
}
