import crypto from 'node:crypto'

/**
 * RFC 2045 multipart/mixed MIME mesajı üretir — SES SendEmailCommand Raw
 * content için. nodemailer/MimeNode bağımlılığı kaldırıldıktan sonra
 * `sendInvoiceEmail` PDF attachment'ı bu helper ile gönderilir.
 *
 * - Boundary 96-bit random hex (çakışma pratik olarak imkansız)
 * - Subject UTF-8 base64 encoded (RFC 2047)
 * - Body parts base64 + 76-char satır wrap (RFC 2045)
 * - CRLF line ending (RFC 5322)
 */
export function buildRawMime(opts: {
  from: string
  to: string
  subject: string
  html: string
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>
}): Buffer {
  const boundary = `----=_HLMS_${crypto.randomBytes(12).toString('hex')}`
  const lines: string[] = []

  lines.push(`From: ${opts.from}`)
  lines.push(`To: ${opts.to}`)
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf-8').toString('base64')}?=`)
  lines.push('MIME-Version: 1.0')
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
  lines.push('')

  lines.push(`--${boundary}`)
  lines.push('Content-Type: text/html; charset=utf-8')
  lines.push('Content-Transfer-Encoding: base64')
  lines.push('')
  lines.push(wrapBase64(Buffer.from(opts.html, 'utf-8').toString('base64')))
  lines.push('')

  for (const att of opts.attachments) {
    lines.push(`--${boundary}`)
    lines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`)
    lines.push('Content-Transfer-Encoding: base64')
    lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
    lines.push('')
    lines.push(wrapBase64(att.content.toString('base64')))
    lines.push('')
  }

  lines.push(`--${boundary}--`)

  return Buffer.from(lines.join('\r\n'), 'utf-8')
}

function wrapBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64
}
