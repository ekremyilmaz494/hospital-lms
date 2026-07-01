/**
 * TC Kimlik No — anahtar rotasyonu + HKDF rehash script'i (KVKK).
 *
 * NEDEN: `src/lib/tc-crypto.ts` iki bekleyen bakım ihtiyacına işaret ediyordu:
 *   1) ENCRYPTION_KEY rotasyonu: yeni anahtarla tüm tc_encrypted yeniden şifrelenmeli + rehash.
 *   2) TC_HMAC_HKDF=true açmadan ÖNCE tüm tc_hash satırları HKDF-türetilmiş HMAC anahtarıyla
 *      yeniden hash'lenmeli (yoksa lookup boş döner).
 * Bu script her ikisini de yapar (User + Invitation). Kod-içi env-tabanlı helper'lar tek anahtar
 * okuduğu için burada kripto AÇIK anahtarlarla, self-contained yapılır.
 *
 * GÜVENLİK:
 *   - Varsayılan DRY-RUN. `--apply` verilmeden DB'ye YAZMAZ.
 *   - Plaintext TC ASLA loglanmaz (yalnız sayaç + tc_hash prefix'i).
 *   - Sırlar env'den okunur; komut satırına/koda yazma.
 *
 * ENV:
 *   DATABASE_URL          — hedef DB (prod rotasyonu için prod DB; .env'den)
 *   TC_ROTATE_OLD_KEY     — mevcut ENCRYPTION_KEY (base64 32B) — tc_encrypted'i çözmek için
 *   TC_ROTATE_NEW_KEY     — (ops.) yeni anahtar (base64 32B). Verilmezse OLD kullanılır
 *                           (yalnız rehash modu: anahtar aynı, sadece HKDF'e geçiş).
 *   TC_ROTATE_NEW_HKDF    — 'true' ise yeni tc_hash HKDF-türetilmiş HMAC anahtarıyla üretilir
 *                           (TC_HMAC_HKDF hedef durumuyla eşleşmeli). Varsayılan 'false'.
 *
 * KULLANIM:
 *   npx tsx scripts/rotate-tc-key.ts             # dry-run (kaç kayıt etkilenecek)
 *   npx tsx scripts/rotate-tc-key.ts --apply     # yaz
 *
 * SONRASI: full rotasyonda ENCRYPTION_KEY'i NEW ile değiştir; HKDF modunda TC_HMAC_HKDF=true yap.
 * Rollback için OLD anahtarı bir süre sakla.
 */
import crypto from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
// ESM import hoisting: prisma dinamik yüklenir — env önce okunmalı.
if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
loadEnv()

const APPLY = process.argv.includes('--apply')
const BATCH = 200

// ── HKDF sabitleri: src/lib/tc-crypto.ts ile BİREBİR aynı olmalı ──
const TC_HMAC_INFO = 'tc-hmac-v1'
const TC_HMAC_SALT = Buffer.from('tc-crypto')

function parseKey(b64: string | undefined, name: string): Buffer {
  if (!b64) throw new Error(`${name} tanımlı değil (env)`)
  const buf = Buffer.from(b64, 'base64')
  if (buf.length !== 32) throw new Error(`${name} tam 32 byte (base64) olmalı`)
  return buf
}

function decryptWith(token: string, key: Buffer): string {
  const parts = token.split(':')
  if (parts.length !== 3) throw new Error('format')
  const [ivHex, tagHex, ctHex] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(ctHex, 'hex')).toString('utf8') + decipher.final('utf8')
}

function encryptWith(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`
}

function deriveHmacKey(master: Buffer, hkdf: boolean): Buffer {
  if (!hkdf) return master
  return Buffer.from(crypto.hkdfSync('sha256', master, TC_HMAC_SALT, Buffer.from(TC_HMAC_INFO), 32))
}

function hashWith(tc: string, hmacKey: Buffer): string {
  return crypto.createHmac('sha256', hmacKey).update(tc).digest('hex')
}

async function main() {
  const oldKey = parseKey(process.env.TC_ROTATE_OLD_KEY, 'TC_ROTATE_OLD_KEY')
  const newKey = process.env.TC_ROTATE_NEW_KEY ? parseKey(process.env.TC_ROTATE_NEW_KEY, 'TC_ROTATE_NEW_KEY') : oldKey
  const newHkdf = process.env.TC_ROTATE_NEW_HKDF === 'true'
  const newHmacKey = deriveHmacKey(newKey, newHkdf)
  const sameKey = newKey.equals(oldKey)

  console.log('[rotate-tc-key] mod:', sameKey ? 'REHASH-ONLY (anahtar aynı)' : 'FULL ROTATION (anahtar değişiyor)',
    '| yeni HKDF:', newHkdf, '| yazma:', APPLY ? 'AÇIK (--apply)' : 'DRY-RUN')

  // Adapter'lı singleton'ı kullan (src/lib/prisma PrismaPg + Pool kurar). Env yukarıda yüklendi.
  const { prisma } = await import('../src/lib/prisma')

  const stats = { user: { total: 0, rotated: 0, failed: 0 }, invitation: { total: 0, rotated: 0, failed: 0 } }
  const failedSamples: string[] = []

  try {
    // ── USER ──
    for (let skip = 0; ; skip += BATCH) {
      const rows = await prisma.user.findMany({
        where: { tcEncrypted: { not: null } },
        select: { id: true, tcEncrypted: true },
        orderBy: { id: 'asc' },
        skip,
        take: BATCH,
      })
      if (rows.length === 0) break
      for (const r of rows) {
        stats.user.total++
        try {
          const tc = decryptWith(r.tcEncrypted!, oldKey)
          const nextCipher = sameKey ? r.tcEncrypted! : encryptWith(tc, newKey)
          const nextHash = hashWith(tc, newHmacKey)
          if (APPLY) {
            await prisma.user.update({ where: { id: r.id }, data: { tcEncrypted: nextCipher, tcHash: nextHash } })
          }
          stats.user.rotated++
        } catch {
          stats.user.failed++
          if (failedSamples.length < 10) failedSamples.push(`user:${r.id.slice(0, 8)}`)
        }
      }
    }

    // ── INVITATION (bekleyen davetlerdeki TC kopyası) ──
    for (let skip = 0; ; skip += BATCH) {
      const rows = await prisma.invitation.findMany({
        where: { tcEncrypted: { not: null } },
        select: { id: true, tcEncrypted: true },
        orderBy: { id: 'asc' },
        skip,
        take: BATCH,
      })
      if (rows.length === 0) break
      for (const r of rows) {
        stats.invitation.total++
        try {
          const tc = decryptWith(r.tcEncrypted!, oldKey)
          const nextCipher = sameKey ? r.tcEncrypted! : encryptWith(tc, newKey)
          const nextHash = hashWith(tc, newHmacKey)
          if (APPLY) {
            await prisma.invitation.update({ where: { id: r.id }, data: { tcEncrypted: nextCipher, tcHash: nextHash } })
          }
          stats.invitation.rotated++
        } catch {
          stats.invitation.failed++
          if (failedSamples.length < 10) failedSamples.push(`invitation:${r.id.slice(0, 8)}`)
        }
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('[rotate-tc-key] User:', stats.user, '| Invitation:', stats.invitation)
  if (failedSamples.length) {
    console.warn('[rotate-tc-key] ÇÖZÜLEMEYEN (eski anahtar yanlış veya legacy plaintext):', failedSamples.join(', '))
    console.warn('  → Bu kayıtlar DEĞİŞTİRİLMEDİ. OLD anahtarı doğrula; legacy plaintext varsa ayrı incele.')
  }
  if (!APPLY) console.log('[rotate-tc-key] DRY-RUN — hiçbir kayıt yazılmadı. Yazmak için --apply ekle.')
}

main().catch((err) => {
  console.error('[rotate-tc-key] HATA:', err instanceof Error ? err.message : err)
  process.exit(1)
})
