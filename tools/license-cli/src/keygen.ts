/**
 * keygen — Ed25519 anahtar çifti üretir (ihraç VEYA makbuz anahtarı).
 *
 * Kullanım:
 *   pnpm --filter @klinovax/license-cli keygen -- --out ~/.config/klinovax/license-issuer.jwk
 *
 * Çıktılar:
 *   - PRIVATE JWK → --out dosyasına (chmod 600). ASLA commit'leme, sunucuya koyma.
 *     İhraç anahtarı: offline/soğuk saklama. Makbuz anahtarı: base64'ü SaaS env'ine.
 *   - PUBLIC JWK → stdout'a; apps/web/src/lib/license/keys.ts içindeki ilgili
 *     sabite yapıştırılır (anahtar töreni — Faz 5).
 */
import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

// pnpm run, script'e ilettigi argumanlarin basina literal "--" koyabilir;
// parseArgs bunu "opsiyonlarin sonu" sayar — soyulmali.
const cliArgs = process.argv.slice(2)
if (cliArgs[0] === '--') cliArgs.shift()

const { values } = parseArgs({
  args: cliArgs,
  options: {
    out: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
})

if (!values.out) {
  console.error('Kullanım: keygen -- --out <private-key-dosyası> [--force]')
  process.exit(1)
}

const outPath = resolve(values.out)
if (existsSync(outPath) && !values.force) {
  console.error(`🛑 ${outPath} zaten var — üzerine yazmak için --force verin.`)
  console.error('   (Mevcut anahtarı kaybetmek, o anahtarla imzalı TÜM lisansları geçersiz kılar!)')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const publicJwk = publicKey.export({ format: 'jwk' })
const privateJwk = privateKey.export({ format: 'jwk' })

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, JSON.stringify(privateJwk, null, 2) + '\n', { mode: 0o600 })

console.log(`✅ PRIVATE anahtar yazıldı (chmod 600): ${outPath}`)
console.log('   → İhraç anahtarıysa: offline/soğuk sakla (USB + kasa). Sunucuya KOYMA.')
console.log('   → Makbuz anahtarıysa SaaS env değeri (LICENSE_RECEIPT_PRIVATE_KEY):')
console.log(`     ${Buffer.from(JSON.stringify(privateJwk)).toString('base64')}`)
console.log('')
console.log('PUBLIC JWK (apps/web/src/lib/license/keys.ts içine):')
console.log(JSON.stringify(publicJwk))
