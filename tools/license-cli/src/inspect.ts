/**
 * inspect — lisans/makbuz JWT'sini çözer ve okunur biçimde basar.
 *
 * Kullanım:
 *   pnpm --filter @klinovax/license-cli inspect -- --file license.klv [--pub <public-jwk-dosyası>]
 *
 * --pub verilirse imza da doğrulanır; verilmezse yalnız içerik gösterilir
 * (UYARI basılır — içerik göstermek imzayı doğrulamaz).
 */
import { createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { compactVerify } from 'jose'

// pnpm run, script'e ilettigi argumanlarin basina literal "--" koyabilir;
// parseArgs bunu "opsiyonlarin sonu" sayar — soyulmali.
const cliArgs = process.argv.slice(2)
if (cliArgs[0] === '--') cliArgs.shift()

const { values } = parseArgs({
  args: cliArgs,
  options: {
    file: { type: 'string' },
    pub: { type: 'string' },
  },
})

if (!values.file) {
  console.error('Kullanım: inspect -- --file <license.klv|receipt.klr> [--pub <public-jwk>]')
  process.exit(1)
}

const jwt = readFileSync(values.file, 'utf8').trim()
const parts = jwt.split('.')
if (parts.length !== 3) {
  console.error('🛑 Dosya JWT biçiminde değil (3 parça bekleniyor)')
  process.exit(1)
}

const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>

if (values.pub) {
  const publicJwk = JSON.parse(readFileSync(values.pub, 'utf8')) as Record<string, string>
  const key = createPublicKey({ key: publicJwk, format: 'jwk' })
  try {
    await compactVerify(jwt, key, { algorithms: ['EdDSA'] })
    console.log('✅ İMZA GEÇERLİ')
  } catch {
    console.error('🛑 İMZA GEÇERSİZ — dosya kurcalanmış veya farklı anahtarla imzalanmış')
    process.exit(1)
  }
} else {
  console.log('⚠️  İmza DOĞRULANMADI (--pub verilmedi) — yalnız içerik gösteriliyor')
}

console.log('')
console.log('Header :', JSON.stringify(header))
console.log('Payload:')
console.log(JSON.stringify(payload, null, 2))

if (typeof payload.iat === 'number') {
  console.log('')
  console.log(`iat  → ${new Date(payload.iat * 1000).toISOString()}`)
}
if (typeof payload.exp === 'number') {
  console.log(`exp  → ${new Date(payload.exp * 1000).toISOString()}`)
}
if (typeof payload.validUntil === 'string') {
  const days = Math.ceil((Date.parse(payload.validUntil) - Date.now()) / 86_400_000)
  console.log(`bitiş → ${payload.validUntil} (${days} gün)`)
} else if (payload.validUntil === null) {
  console.log('bitiş → SÜRESİZ')
}
