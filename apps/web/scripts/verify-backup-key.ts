/**
 * Backup şifreleme anahtarı doğrulama aracı.
 *
 * Kullanım:
 *   pnpm tsx scripts/verify-backup-key.ts <hex-key>
 *   # veya env ile:
 *   BACKUP_KEY_TO_TEST=<hex-key> pnpm tsx scripts/verify-backup-key.ts
 *
 * Ne yapar:
 *   1) Veritabanından son şifrelenmiş `auto` yedek kaydını bulur (fileUrl != 'local')
 *   2) S3'ten dosyayı indirir
 *   3) Verilen anahtarla AES-256-GCM çözmeye çalışır
 *   4) Sonuç JSON ise "anahtar doğru", değilse "anahtar yanlış" raporu üretir
 *
 * Önemli: Bu araç DB'ye/S3'e SADECE OKUMA yapar. Hiçbir şey yazmaz, silmez.
 *         Anahtar sadece bellekte tutulur, log'a yazılmaz.
 */

import 'dotenv/config'
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import crypto from 'crypto'
import { prisma } from '../src/lib/prisma'
import { downloadBuffer } from '../src/lib/s3'

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

function tryDecrypt(data: string, hexKey: string): { ok: true; plaintext: string } | { ok: false; reason: string } {
  const parts = data.split(':')
  if (parts.length !== 3) return { ok: false, reason: 'Format hatalı (iv:tag:ct değil) — bu yedek muhtemelen ŞİFRESİZ kaydedilmiş.' }
  const [ivHex, authTagHex, ciphertextHex] = parts
  if (ivHex.length !== 24) return { ok: false, reason: `IV uzunluğu beklenmeyen (${ivHex.length}, beklenen 24).` }
  if (authTagHex.length !== 32) return { ok: false, reason: `authTag uzunluğu beklenmeyen (${authTagHex.length}, beklenen 32).` }

  try {
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    return { ok: true, plaintext }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Bilinmeyen hata' }
  }
}

async function main() {
  const keyArg = process.argv[2] || process.env.BACKUP_KEY_TO_TEST
  if (!keyArg) {
    fail('Kullanım: pnpm tsx scripts/verify-backup-key.ts <64-karakter-hex-key>')
  }
  const hexKey = keyArg.trim()
  if (hexKey.length !== 64) {
    fail(`Anahtar 64 karakter hex olmalı (girilen: ${hexKey.length} karakter).`)
  }
  if (!/^[0-9a-fA-F]+$/.test(hexKey)) {
    fail('Anahtar sadece hex karakter (0-9, a-f) içermeli.')
  }

  console.log('🔎 Son şifrelenmiş yedek aranıyor (manuel veya otomatik)...')
  const candidate = await prisma.dbBackup.findFirst({
    where: {
      status: 'completed',
      NOT: { fileUrl: 'local' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileUrl: true, createdAt: true, organizationId: true, fileSizeMb: true, backupType: true },
  })

  if (!candidate) {
    console.error(`\n❌ Test edilebilecek S3'te şifreli yedek bulunamadı.\n`)
    console.error(`   Önce bir yedek almanız gerekiyor. Seçenekler:`)
    console.error(`     1) /admin/backups sayfasına gidip "Manuel Yedek Al" butonuna tıklayın`)
    console.error(`     2) Lokalde cron'u manuel tetikleyin (dev server çalışıyorsa):`)
    console.error(`        curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/backup`)
    console.error(`        (CRON_SECRET .env.local'de tanımlı)`)
    console.error(`\n   Yedeği aldıktan sonra bu komutu tekrar çalıştırın.\n`)
    process.exit(1)
  }

  console.log(`✅ Yedek bulundu:`)
  console.log(`   ID:            ${candidate.id}`)
  console.log(`   Tür:           ${candidate.backupType}`)
  console.log(`   Tarih:         ${candidate.createdAt.toLocaleString('tr-TR')}`)
  console.log(`   Boyut:         ${candidate.fileSizeMb ?? '?'} MB`)
  console.log(`   S3 key:        ${candidate.fileUrl}`)
  console.log(`   organizationId:${candidate.organizationId}\n`)

  console.log('⬇️  S3\'ten indiriliyor...')
  let buf: Buffer
  try {
    buf = await downloadBuffer(candidate.fileUrl)
  } catch (err) {
    fail(`S3 indirme başarısız: ${err instanceof Error ? err.message : err}`)
  }
  console.log(`   ${buf.byteLength} byte alındı.\n`)

  console.log('🔐 Anahtar test ediliyor...')
  const result = tryDecrypt(buf.toString('utf-8'), hexKey)

  if (!result.ok) {
    console.error(`\n❌ ANAHTAR YANLIŞ veya yedek bozuk.`)
    console.error(`   Sebep: ${result.reason}\n`)
    console.error(`   Olası nedenler:`)
    console.error(`     • Anahtar farklı (yanlış kopyalandı, eski/yeni karışmış)`)
    console.error(`     • Yedek başka bir anahtarla şifrelenmiş`)
    console.error(`     • Yedek dosyası bozulmuş (S3 transfer hatası)`)
    process.exit(2)
  }

  // Plaintext JSON parse edilebilmeli
  let parsed: { organizationId?: string; exportedAt?: string; users?: unknown[]; trainings?: unknown[] }
  try {
    parsed = JSON.parse(result.plaintext)
  } catch {
    console.error(`\n⚠️  Anahtar AES auth-tag'i geçti ama JSON parse edilemedi. Anahtar olasılıkla doğru ama yedek bozuk.`)
    process.exit(3)
  }

  console.log(`\n✅ ANAHTAR DOĞRU!`)
  console.log(`   Yedeğin içeriği başarıyla çözüldü ve JSON parse edildi.`)
  console.log(`   Içerik özeti:`)
  console.log(`     organizationId: ${parsed.organizationId}`)
  console.log(`     exportedAt:     ${parsed.exportedAt}`)
  console.log(`     users:          ${Array.isArray(parsed.users) ? parsed.users.length : 0} kayıt`)
  console.log(`     trainings:      ${Array.isArray(parsed.trainings) ? parsed.trainings.length : 0} kayıt`)
  console.log(`     plaintext size: ${result.plaintext.length} byte\n`)
}

main()
  .catch(err => {
    console.error('\n❌ Beklenmeyen hata:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
