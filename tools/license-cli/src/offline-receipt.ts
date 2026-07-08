/**
 * offline-receipt — kapalı ağ (air-gap) müşterisi için imzalı doğrulama
 * makbuzu üretir. Müşteri sunucusu internete HİÇ çıkamıyorsa heartbeat
 * yapamaz; bu makbuz dosyası /license ekranından elle yüklenerek offline
 * grace penceresi yenilenir.
 *
 * Kullanım:
 *   pnpm --filter @klinovax/license-cli offline-receipt -- \
 *     --key <makbuz-private-jwk> --license-id <uuid> --instance-id <uuid> \
 *     [--status valid|revoked] [--days 35] --out receipt.klr
 *
 * license-id + instance-id super-admin → Lisanslar → detay sayfasından okunur
 * (kurulum /license ekranında da instanceId'yi gösterir).
 */
import { createPrivateKey } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { SignJWT } from 'jose'

// pnpm run, script'e ilettigi argumanlarin basina literal "--" koyabilir;
// parseArgs bunu "opsiyonlarin sonu" sayar — soyulmali.
const cliArgs = process.argv.slice(2)
if (cliArgs[0] === '--') cliArgs.shift()

const { values } = parseArgs({
  args: cliArgs,
  options: {
    key: { type: 'string' },
    'license-id': { type: 'string' },
    'instance-id': { type: 'string' },
    status: { type: 'string', default: 'valid' },
    days: { type: 'string', default: '35' },
    out: { type: 'string' },
  },
})

function fail(msg: string): never {
  console.error(`🛑 ${msg}`)
  process.exit(1)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!values.key) fail('--key <makbuz-private-jwk> zorunlu')
if (!values['license-id'] || !UUID_RE.test(values['license-id'])) fail('--license-id geçerli UUID olmalı')
if (!values['instance-id'] || !UUID_RE.test(values['instance-id'])) fail('--instance-id geçerli UUID olmalı')
if (!values.out) fail('--out <receipt.klr> zorunlu')
if (values.status !== 'valid' && values.status !== 'revoked') fail('--status valid|revoked olmalı')
const days = Number(values.days)
if (!Number.isInteger(days) || days < 1 || days > 90) fail('--days 1-90 arası olmalı')

const privateJwk = JSON.parse(readFileSync(values.key, 'utf8')) as Record<string, string>
if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
  fail('--key dosyası Ed25519 PRIVATE JWK değil')
}
const key = createPrivateKey({ key: privateJwk, format: 'jwk' })

const nowUnix = Math.floor(Date.now() / 1000)
const jwt = await new SignJWT({
  iss: 'klinovax-receipt',
  licenseId: values['license-id'],
  instanceId: values['instance-id'],
  status: values.status as 'valid' | 'revoked',
  iat: nowUnix,
  exp: nowUnix + days * 86400,
  renewedLicense: null,
})
  .setProtectedHeader({ alg: 'EdDSA' })
  .sign(key)

writeFileSync(values.out, jwt + '\n')
console.log('✅ Offline makbuz imzalandı')
console.log(`   Dosya:   ${values.out}`)
console.log(`   Geçerli: ${days} gün (${new Date((nowUnix + days * 86400) * 1000).toISOString()})`)
console.log('   Müşteri /license ekranından "Offline Makbuz Yükle" ile içeri alır.')
