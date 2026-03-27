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

export function forgotPasswordEmail(name: string, resetLink: string) {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d9668, #0f4a35); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Hastane LMS</h1>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1e293b; margin-top: 0;">Sifre Sifirlama</h2>
        <p style="color: #64748b;">Merhaba ${name},</p>
        <p style="color: #64748b;">Hesabiniz icin bir sifre sifirlama istegi aldik. Asagidaki butona tiklayarak yeni sifrenizi belirleyebilirsiniz:</p>
        <a href="${resetLink}"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Sifremi Sifirla
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Bu link 1 saat icerisinde gecerliliginizi yitirecektir. Eger siz bu istegi yapmadiysa bu e-postayi goz ardi edebilirsiniz.</p>
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
        <h2 style="color: #1e293b; margin-top: 0;">Hos Geldiniz!</h2>
        <p style="color: #64748b;">Merhaba ${name},</p>
        <p style="color: #64748b;">Hastane LMS hesabiniz olusturulmustur.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>E-posta:</strong> ${email}</p>
        </div>
        <p style="color: #64748b;">Hesabiniza erisim icin asagidaki butona tiklayarak sifrenizi belirleyin:</p>
        <a href="${resetLink}"
           style="display: inline-block; background: #0d9668; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Sifremi Belirle
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Bu link 24 saat icerisinde gecerliliginizi yitirecektir.</p>
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
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Sertifika Yenileme Hatirlatmasi</p>
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: bold; color: ${urgencyColor};">${urgencyLabel}</p>
        </div>
        <p style="color: #64748b;">Merhaba ${staffName},</p>
        <p style="color: #64748b;"><strong>"${trainingTitle}"</strong> egitim sertifikanizin gecerlilik suresi dolmak uzere.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0; color: #475569;"><strong>Sertifika:</strong> ${trainingTitle}</p>
          <p style="margin: 4px 0; color: #475569;"><strong>Gecerlilik Tarihi:</strong> ${expiryDate}</p>
        </div>
        <p style="color: #64748b;">Sertifikanizin suresi dolmadan once egitimi tekrar tamamlamaniz gerekmektedir.</p>
        <a href="${renewLink}"
           style="display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Egitimi Yenile
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
          <p style="margin: 0; font-weight: bold; color: #dc2626;">${daysOverdue} gun gecikti!</p>
        </div>
        <p style="color: #64748b;">Merhaba ${staffName},</p>
        <p style="color: #64748b;"><strong>"${trainingTitle}"</strong> egitiminiz ${dueDate} tarihinde tamamlanmasi gerekiyordu.</p>
        <p style="color: #64748b;">Lutfen en kisa surede bu egitimi tamamlayiniz.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/staff/my-trainings"
           style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          Egitimi Tamamla
        </a>
      </div>
    </div>
  `
}
