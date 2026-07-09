/**
 * issue — imzalı lisans dosyası (license.klv = ham JWT) üretir.
 *
 * Kullanım:
 *   pnpm --filter @klinovax/license-cli issue -- \
 *     --key ~/.config/klinovax/license-issuer.jwk \
 *     --customer "Özel Devakent Hastanesi" --slug devakent \
 *     --valid-until 2027-07-01 --max-staff 500 --max-orgs 1 \
 *     [--grace-days 14] [--type standard|trial] [--perpetual] \
 *     --out Klinovax-devakent-license.klv
 *
 * Akış: bu JWT (1) super-admin → Lisanslar sayfasına KAYDEDİLİR (iptal/izleme
 * için şart), (2) license.klv olarak müşteriye teslim edilir.
 */
import { createPrivateKey } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
    customer: { type: 'string' },
    slug: { type: 'string' },
    'valid-until': { type: 'string' },
    perpetual: { type: 'boolean', default: false },
    'max-staff': { type: 'string' },
    'max-orgs': { type: 'string' },
    'max-instances': { type: 'string' },
    'grace-days': { type: 'string', default: '14' },
    type: { type: 'string', default: 'standard' },
    out: { type: 'string' },
  },
})

function fail(msg: string): never {
  console.error(`🛑 ${msg}`)
  process.exit(1)
}

if (!values.key) fail('--key <ihraç-private-jwk-dosyası> zorunlu')
if (!values.customer) fail('--customer "<müşteri adı>" zorunlu')
if (!values.slug) fail('--slug <müşteri-slug> zorunlu')
if (!values.out) fail('--out <license.klv> zorunlu')
if (!values.perpetual && !values['valid-until']) {
  fail('--valid-until YYYY-MM-DD verin veya süresiz için --perpetual bayrağını kullanın')
}
if (values.perpetual && values['valid-until']) {
  fail('--perpetual ile --valid-until birlikte verilemez')
}
if (values.type !== 'standard' && values.type !== 'trial') fail('--type standard|trial olmalı')

let validUntil: string | null = null
if (!values.perpetual) {
  const parsed = new Date(`${values['valid-until']}T23:59:59+03:00`)
  if (Number.isNaN(parsed.getTime())) fail(`--valid-until geçersiz tarih: ${values['valid-until']}`)
  if (parsed.getTime() < Date.now()) fail('--valid-until geçmişte olamaz')
  validUntil = parsed.toISOString()
}

const graceDays = Number(values['grace-days'])
if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 90) {
  fail('--grace-days 1-90 arası tam sayı olmalı')
}
const maxStaff = values['max-staff'] ? Number(values['max-staff']) : null
const maxOrgs = values['max-orgs'] ? Number(values['max-orgs']) : null
// maxInstances: gelir koruma (klon limiti). Verilmezse null (sınırsız — geriye uyumlu).
// KISITLI-ÇIKIŞ kurulumlarda heartbeat aşımda lisansı kilitler; tam air-gap'te zorlanamaz.
const maxInstances = values['max-instances'] ? Number(values['max-instances']) : null
if (maxStaff !== null && (!Number.isInteger(maxStaff) || maxStaff < 1)) fail('--max-staff pozitif tam sayı olmalı')
if (maxOrgs !== null && (!Number.isInteger(maxOrgs) || maxOrgs < 1)) fail('--max-orgs pozitif tam sayı olmalı')
if (maxInstances !== null && (!Number.isInteger(maxInstances) || maxInstances < 1)) fail('--max-instances pozitif tam sayı olmalı')

const privateJwk = JSON.parse(readFileSync(values.key, 'utf8')) as Record<string, string>
if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d) {
  fail('--key dosyası Ed25519 PRIVATE JWK değil')
}
const key = createPrivateKey({ key: privateJwk, format: 'jwk' })

const licenseId = randomUUID()
const claims = {
  iss: 'klinovax-license',
  jti: licenseId,
  sub: values.slug,
  iat: Math.floor(Date.now() / 1000),
  schemaVersion: 1,
  customerName: values.customer,
  licenseType: values.type as 'standard' | 'trial',
  validUntil,
  limits: { maxOrganizations: maxOrgs, maxStaff, maxInstances },
  graceDays,
}

const jwt = await new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA' }).sign(key)
writeFileSync(values.out, jwt + '\n')

console.log('✅ Lisans imzalandı')
console.log(`   Dosya:      ${values.out}`)
console.log(`   licenseId:  ${licenseId}`)
console.log(`   Müşteri:    ${values.customer} (${values.slug})`)
console.log(`   Bitiş:      ${validUntil ?? 'SÜRESİZ'}`)
console.log(`   Limitler:   org=${maxOrgs ?? '∞'} personel=${maxStaff ?? '∞'} instance=${maxInstances ?? '∞'} grace=${graceDays}g`)
console.log('')
console.log('SONRAKİ ADIMLAR:')
console.log('  1. JWT içeriğini super-admin → Lisanslar → "Lisans Kaydet"e yapıştır (iptal/izleme için ŞART)')
console.log('  2. Dosyayı müşteriye license.klv olarak teslim et')
