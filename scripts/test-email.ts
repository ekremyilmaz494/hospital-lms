/**
 * SES test mail aracı.
 *
 * Kullanım:
 *   npx tsx scripts/test-email.ts <to-email> [--org=<organizationId>]
 *
 * Örnek:
 *   npx tsx scripts/test-email.ts ekrem1452aa@gmail.com
 *
 * Önemli: ESM modüllerinde `import` statement'ları top-level'da statik olarak
 * hoist edilir; Prisma/SES singleton'ları o sırada init oluyor. dotenv yüklemeyi
 * bekleyemiyoruz. Bu yüzden önce `loadEnv()` çağrılır, sonra `sendEmail` dinamik
 * import edilir — bu sırada DATABASE_URL ve AWS_* env'leri set edilmiş oluyor.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnv() {
  const candidates = ['.env.local', '.env']
  for (const file of candidates) {
    const absPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(absPath)) continue
    const content = fs.readFileSync(absPath, 'utf-8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      // Tırnak işaretlerini soy
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const to = args.find(a => !a.startsWith('--'))
  const orgArg = args.find(a => a.startsWith('--org='))
  const organizationId = orgArg ? orgArg.split('=')[1] : undefined

  if (!to) {
    console.error('Kullanım: npx tsx scripts/test-email.ts <to-email> [--org=<id>]')
    process.exit(1)
  }

  loadEnv()

  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env eksik (.env.local kontrol edin)')
    process.exit(1)
  }

  // Dynamic import: env yüklendikten sonra modül init olmalı
  const { sendEmail } = await import('@/lib/email')
  const { BRAND } = await import('@/lib/brand')

  const subject = `${BRAND.name} · Test Mail (CLI)`
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 24px auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="margin: 0 0 12px; color: #0f172a;">${BRAND.fullName}</h2>
      <p style="color: #475569; line-height: 1.6;">
        Bu, <code>scripts/test-email.ts</code> CLI aracılığıyla AWS SES üzerinden gönderilen bir test e-postasıdır.
      </p>
      <ul style="color: #475569; font-size: 13px;">
        <li>Region: ${process.env.AWS_REGION}</li>
        <li>From: ${BRAND.fromAddress}</li>
        <li>Org ID: ${organizationId ?? '(none — platform akışı)'}</li>
        <li>Timestamp: ${new Date().toISOString()}</li>
      </ul>
    </div>
  `

  console.log(`→ ${to} adresine SES test mail gönderiliyor...`)
  try {
    const result = await sendEmail({
      to,
      subject,
      html,
      organizationId,
      transactional: true,
    })
    if (result) {
      console.log('✅ Mail gönderildi.')
    } else {
      console.log('⚠️ Gönderim atlandı (org opt-out veya yok).')
    }
  } catch (err) {
    console.error('❌ Hata:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
