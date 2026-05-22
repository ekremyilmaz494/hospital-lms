/**
 * Video durationSeconds backfill — eski/bozuk video sürelerini düzeltir.
 *
 * Sorun (Plan: birden-fazla-agentla... Faz 1, Adım 5):
 *   Video yüklemede süre HİÇ ölçülmüyordu (upload-manager.tsx yalnız 'audio'
 *   ölçüyordu). publish/route.ts ölçülmemiş video'lara `|| 300` ile 5 dk default
 *   yazıyordu. Sınav %80 tamamlanma kapısı bu yanlış süreye dayandığı için:
 *     - DB süre < gerçek video → personel video ortasında "tamamlandı" sayılıp
 *       akıştan atılıyor.
 *     - DB süre > gerçek video → %80 eşiğine asla ulaşılamıyor, video hiç
 *       tamamlanmıyor (personel "Son Sınava Git" göremiyor).
 *   upload-manager.tsx ve publish/route.ts düzeltildi → YENİ video'lar doğru.
 *   Bu script ESKİ video'ları düzeltir.
 *
 * Çalışma:
 *   Her video'nun S3 dosyasından MP4 `mvhd` (movie header) atomunu okuyarak
 *   gerçek süreyi çıkarır. moov atomu dosyanın başında da sonunda da olabilir;
 *   bu yüzden hem ilk 1.5MB hem son 4MB taranır. Süre bulunamayan video'lar
 *   raporlanır (manuel inceleme için) — dokunulmaz.
 *
 * GÜVENLİK: Varsayılan DRY-RUN — `--apply` verilmeden DB'ye YAZMAZ.
 *   Yalnızca probe BAŞARILI olan ve DB değeri farklı olan kayıtlar güncellenir.
 *   Probe başarısız olanlar yalnızca raporlanır (otomatik sıfırlama YOK).
 *
 * Kullanım:
 *   npx tsx scripts/backfill-video-durations.ts            # dry-run, son 200
 *   npx tsx scripts/backfill-video-durations.ts --all      # dry-run, tümü
 *   npx tsx scripts/backfill-video-durations.ts --all --apply   # tümünü yaz
 */

import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
// ESM import hoisting nedeniyle prisma dinamik yüklenir — env önce okunmalı.
if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
loadEnv()

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'node:stream'

const args = process.argv.slice(2)
const ALL = args.includes('--all')
const APPLY = args.includes('--apply')
const limitArgIdx = args.indexOf('--limit')
const LIMIT = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : (ALL ? 5000 : 200)

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET
if (!BUCKET) {
  console.error('❌ AWS_S3_BUCKET env değişkeni yok')
  process.exit(1)
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** S3'ten verilen HTTP Range ifadesiyle byte aralığı indirir. */
async function fetchRange(key: string, range: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range }))
  if (!res.Body) throw new Error('S3 body boş')
  return streamToBuffer(res.Body as Readable)
}

/**
 * Buffer içinde MP4 `mvhd` (movie header) atomunu arar ve süreyi saniye olarak
 * döner. `mvhd` dosyada tektir ve küçüktür (~100 byte); ASCII imzasıyla doğrudan
 * aranır — tüm atom ağacını yürümeye gerek yok.
 *
 * mvhd layout (idx = 'mvhd' tipinin başlangıç indeksi):
 *   idx+4: version (1 byte)
 *   version 0: timescale @ idx+16 (u32), duration @ idx+20 (u32)
 *   version 1: timescale @ idx+24 (u32), duration @ idx+28 (u64)
 *
 * Mantıksız değerler (timescale<=0, süre 0 veya >24s) null döner — mdat içindeki
 * rastlantısal "mvhd" byte eşleşmelerini eler.
 */
function parseMvhdSeconds(buf: Buffer): number | null {
  const idx = buf.indexOf(Buffer.from('mvhd', 'ascii'))
  if (idx < 0) return null
  const version = idx + 4 < buf.length ? buf.readUInt8(idx + 4) : -1

  let timescale: number
  let duration: number
  if (version === 1) {
    if (idx + 36 > buf.length) return null
    timescale = buf.readUInt32BE(idx + 24)
    const hi = buf.readUInt32BE(idx + 28)
    const lo = buf.readUInt32BE(idx + 32)
    duration = hi * 0x1_0000_0000 + lo
  } else if (version === 0) {
    if (idx + 24 > buf.length) return null
    timescale = buf.readUInt32BE(idx + 16)
    duration = buf.readUInt32BE(idx + 20)
  } else {
    return null
  }

  if (!timescale || timescale <= 0) return null
  const seconds = Math.round(duration / timescale)
  // Sağduyu sınırı: 1 sn – 24 saat. Dışındaysa muhtemelen yanlış eşleşme.
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) return null
  return seconds
}

/** Video'nun gerçek süresini probe eder — moov başta veya sonda olabilir. */
async function probeDurationSeconds(key: string): Promise<number | null> {
  // 1) İlk 1.5MB — faststart (moov başta) video'lar.
  try {
    const head = await fetchRange(key, 'bytes=0-1572863')
    const d = parseMvhdSeconds(head)
    if (d !== null) return d
  } catch { /* aşağıda tail denenir */ }

  // 2) Son 4MB — moov dosyanın sonunda (faststart uygulanmamış) video'lar.
  try {
    const tail = await fetchRange(key, 'bytes=-4194304')
    return parseMvhdSeconds(tail)
  } catch {
    return null
  }
}

async function main() {
  console.log(`\n🎬 Video süre backfill — ${ALL ? 'tüm video\'lar' : `son ${LIMIT}`} · ${APPLY ? 'APPLY (DB yazılacak)' : 'DRY-RUN (yazılmaz)'}\n`)

  const { prisma } = await import('../src/lib/prisma')

  const videos = await prisma.trainingVideo.findMany({
    where: { contentType: 'video' },
    select: {
      id: true,
      title: true,
      videoKey: true,
      durationSeconds: true,
      training: { select: { title: true } },
    },
    take: LIMIT,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Bulundu: ${videos.length} video (contentType=video)\n`)
  console.log('─'.repeat(88))

  const stats = { fixed: 0, alreadyOk: 0, unprobed: 0 }
  const unprobedList: Array<{ id: string; key: string; stored: number }> = []

  for (const v of videos) {
    const label = `[${(v.training.title ?? '').slice(0, 24)}] ${(v.title ?? '').slice(0, 28)}`.padEnd(60)
    if (!v.videoKey) {
      console.log(`${label} ⏭️  videoKey yok`)
      continue
    }

    const probed = await probeDurationSeconds(v.videoKey)

    if (probed === null) {
      stats.unprobed++
      unprobedList.push({ id: v.id, key: v.videoKey, stored: v.durationSeconds })
      console.log(`${label} ❓ probe başarısız (DB=${v.durationSeconds}sn) — dokunulmadı`)
      continue
    }

    // 2 sn tolerans — yuvarlama farklarını gürültü sayma.
    if (Math.abs(probed - v.durationSeconds) <= 2) {
      stats.alreadyOk++
      console.log(`${label} ✅ doğru (${probed}sn)`)
      continue
    }

    stats.fixed++
    console.log(`${label} 🔧 ${v.durationSeconds}sn → ${probed}sn`)
    if (APPLY) {
      await prisma.trainingVideo.update({
        where: { id: v.id },
        data: { durationSeconds: probed },
      })
    }
  }

  console.log('─'.repeat(88))
  console.log(`\n📊 ÖZET`)
  console.log(`   ✅ Zaten doğru:        ${stats.alreadyOk}`)
  console.log(`   🔧 Düzeltil${APPLY ? 'di' : 'ecek'}:  ${stats.fixed}`)
  console.log(`   ❓ Probe başarısız:    ${stats.unprobed}`)

  if (unprobedList.length > 0) {
    console.log(`\n❓ Süresi okunamayan video'lar (MP4 değil olabilir; durationSeconds<=0 olanlar`)
    console.log(`   exam route'unda doğal-bitiş tamamlamasıyla zaten güvenli):`)
    for (const u of unprobedList) {
      console.log(`   - ${u.id}  DB=${u.stored}sn  ${u.key}`)
    }
  }

  if (!APPLY && stats.fixed > 0) {
    console.log(`\nℹ️  DRY-RUN — hiçbir şey yazılmadı. Uygulamak için: --apply`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('\n❌ Script hatası:', err)
  process.exit(1)
})
