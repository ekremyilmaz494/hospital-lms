import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * SMTP e-posta sürücüsü — on-prem dağıtımlar için Brevo alternatifi.
 *
 * `EMAIL_DRIVER=smtp` iken `src/lib/email.ts` gönderimleri buraya yönlendirir.
 * Yapılandırma tamamen env'den:
 *   SMTP_HOST   (zorunlu)
 *   SMTP_PORT   (varsayılan 587)
 *   SMTP_SECURE ('true' → implicit TLS/465; aksi halde STARTTLS)
 *   SMTP_USER / SMTP_PASS (opsiyonel — LAN relay'lerde auth olmayabilir)
 */
let transporterInstance: Transporter | null = null

function getSmtpTransport(): Transporter {
  if (transporterInstance) return transporterInstance
  const host = process.env.SMTP_HOST
  if (!host) throw new Error('SMTP_HOST env var eksik (EMAIL_DRIVER=smtp)')
  transporterInstance = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } }
      : {}),
  })
  return transporterInstance
}

export interface SmtpSendParams {
  fromName: string
  fromAddress: string
  to: string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: Buffer }>
}

/** Tek e-postayı SMTP üzerinden gönderir. Hata fırlatabilir — retry çağırana aittir. */
export async function sendViaSmtp(params: SmtpSendParams): Promise<void> {
  await getSmtpTransport().sendMail({
    from: { name: params.fromName, address: params.fromAddress },
    to: params.to,
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachments ? { attachments: params.attachments } : {}),
  })
}

/**
 * SMTP hatasının yeniden denenebilir olup olmadığı — geçici SMTP kodları
 * (421 servis kapalı, 4xx geçici ret) ve bağlantı hataları retryable sayılır.
 */
export function isRetryableSmtpError(err: unknown): boolean {
  const e = err as { responseCode?: number; code?: string }
  if (typeof e?.responseCode === 'number' && e.responseCode >= 400 && e.responseCode < 500) return true
  return e?.code === 'ECONNECTION' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNRESET'
}
