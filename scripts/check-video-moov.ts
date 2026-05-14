/**
 * MP4 moov atom diagnostic — eğitim videolarının streaming için uygun yapıda olup
 * olmadığını kontrol eder. Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md B1 hipotezi.
 *
 * Çalışma: Her video için S3'ten ilk 1MB byte-range fetch ile çeker, MP4 atom
 * yapısını yürür ve `moov` ile `mdat` atomlarının konumunu raporlar.
 *
 * - moov atomu mdat'tan ÖNCE → ✅ progressive streaming çalışır
 * - moov atomu mdat'tan SONRA veya ilk 1MB'da YOK → ⚠️ moov muhtemelen dosyanın
 *   sonunda; player tüm dosyayı indirmeden metadata göremez → "duraklıyor" algısı
 *
 * Kullanım:
 *   npx tsx scripts/check-video-moov.ts              # son 20 video
 *   npx tsx scripts/check-video-moov.ts --all        # tümü
 *   npx tsx scripts/check-video-moov.ts --limit 50   # özel limit
 */

import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
// .env.local önce, sonra .env (next.js davranışına benzer öncelik).
// ESM import hoisting nedeniyle prisma'yı dinamik yükleyeceğiz — bu yüzden env
// burada yüklenmeli, prisma require edilmeden ÖNCE.
if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
loadEnv()

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Readable } from 'node:stream'

const args = process.argv.slice(2)
const ALL = args.includes('--all')
const limitArgIdx = args.indexOf('--limit')
const LIMIT = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : (ALL ? 1000 : 20)

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

interface AtomInfo {
  type: string
  offset: number
  size: number
}

/**
 * MP4 atom yapısını yürür. Her atom: [4 byte big-endian size][4 ASCII type][...payload].
 * `moov` ve `mdat` offset'lerini döner; bulunamadıysa null.
 *
 * Not: 64-bit "extended size" (size===1) için 8 byte ek size okunur — çok büyük
 * `mdat` atomları için yaygın.
 */
function findAtoms(buffer: Buffer): { moov: number | null; mdat: number | null; atoms: AtomInfo[] } {
  let pos = 0
  const atoms: AtomInfo[] = []
  let moov: number | null = null
  let mdat: number | null = null
  while (pos < buffer.length - 8) {
    const size = buffer.readUInt32BE(pos)
    const type = buffer.subarray(pos + 4, pos + 8).toString('ascii')
    let realSize = size
    if (size === 1) {
      const high = buffer.readUInt32BE(pos + 8)
      const low = buffer.readUInt32BE(pos + 12)
      realSize = high * 0x100000000 + low
    } else if (size === 0) {
      realSize = buffer.length - pos
    }
    if (!/^[a-zA-Z0-9 ]{4}$/.test(type)) break
    atoms.push({ type, offset: pos, size: realSize })
    if (type === 'moov' && moov === null) moov = pos
    if (type === 'mdat' && mdat === null) mdat = pos
    if (realSize <= 0) break
    pos += realSize
  }
  return { moov, mdat, atoms }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

async function downloadRange(key: string, end: number) {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Range: `bytes=0-${end - 1}`,
  })
  const res = await s3.send(cmd)
  if (!res.Body) throw new Error('S3 body boş')
  const buffer = await streamToBuffer(res.Body as Readable)
  const totalSize = res.ContentRange ? parseInt(res.ContentRange.split('/')[1] ?? '0', 10) : null
  return { buffer, totalSize }
}

interface CheckResult {
  verdict: 'OK' | 'PROBLEM' | 'ERROR'
  detail: string
}

async function checkVideo(videoKey: string): Promise<CheckResult> {
  const FETCH_SIZE = 1024 * 1024
  try {
    const { buffer, totalSize } = await downloadRange(videoKey, FETCH_SIZE)
    const { moov, mdat } = findAtoms(buffer)
    const sizeStr = totalSize ? `${(totalSize / 1024 / 1024).toFixed(1)}MB` : '?'

    if (moov === null) {
      return {
        verdict: 'PROBLEM',
        detail: `moov ilk 1MB'da yok (dosya ${sizeStr}) — büyük ihtimal sonda`,
      }
    }
    if (mdat === null) {
      return {
        verdict: 'OK',
        detail: `moov @${moov} bulundu, mdat ilk 1MB'da yok — streamable`,
      }
    }
    if (moov < mdat) {
      return {
        verdict: 'OK',
        detail: `moov @${moov} < mdat @${mdat} — streamable (faststart uygulanmış)`,
      }
    }
    return {
      verdict: 'PROBLEM',
      detail: `mdat @${mdat} < moov @${moov} — moov sonda, faststart gerekli`,
    }
  } catch (err) {
    return { verdict: 'ERROR', detail: (err as Error).message }
  }
}

async function main() {
  console.log(`\n🔍 MP4 moov atom kontrolü — ${ALL ? 'tüm videolar' : `son ${LIMIT} video`}\n`)

  // Prisma'yı dinamik yükle — env okunduktan SONRA module init olsun
  const { prisma } = await import('../src/lib/prisma')

  // videoKey schema'da String (non-nullable) → filter gereksiz
  const videos = await prisma.trainingVideo.findMany({
    select: {
      id: true,
      title: true,
      videoKey: true,
      fileSizeBytes: true,
      training: { select: { title: true, organizationId: true } },
    },
    take: LIMIT,
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Bulundu: ${videos.length} video\n`)
  console.log('─'.repeat(80))

  const stats: Record<string, number> = { OK: 0, PROBLEM: 0, ERROR: 0 }
  const problems: Array<{ id: string; title: string; videoKey: string; orgId: string; sizeMb: string }> = []

  for (const v of videos) {
    if (!v.videoKey) continue
    const tTitle = (v.training.title ?? '').slice(0, 30)
    const vTitle = (v.title ?? '').slice(0, 30)
    const label = `[${tTitle}] ${vTitle}`
    process.stdout.write(`${label.padEnd(65)} ... `)
    const res = await checkVideo(v.videoKey)
    stats[res.verdict]++
    const icon = res.verdict === 'OK' ? '✅' : res.verdict === 'PROBLEM' ? '⚠️ ' : '❌'
    console.log(`${icon} ${res.verdict}`)
    if (res.verdict !== 'OK') {
      console.log(`   ${res.detail}`)
      if (res.verdict === 'PROBLEM') {
        problems.push({
          id: v.id,
          title: v.title ?? '',
          videoKey: v.videoKey,
          orgId: v.training.organizationId ?? '',
          sizeMb: v.fileSizeBytes ? (Number(v.fileSizeBytes) / 1024 / 1024).toFixed(1) : '?',
        })
      }
    }
  }

  console.log('─'.repeat(80))
  console.log(`\n📊 ÖZET`)
  console.log(`   ✅ OK (streamable):     ${stats.OK}`)
  console.log(`   ⚠️  PROBLEM (faststart): ${stats.PROBLEM}`)
  console.log(`   ❌ ERROR:                ${stats.ERROR}`)

  if (problems.length > 0) {
    console.log(`\n⚠️  ${problems.length} video'da moov atom sonda — faststart fix önerilir.`)
    console.log(`Etkilenen video'lar:`)
    for (const p of problems) {
      console.log(`   - ${p.id}  ${p.videoKey}  (${p.sizeMb}MB)`)
    }
    console.log(`\nB1 hipotezi DOĞRULANDI — sonraki adım: ffmpeg ile faststart uygula.`)
  } else if (stats.OK > 0) {
    console.log(`\n✅ Tüm video'lar streaming için optimize.`)
    console.log(`B1 hipotezi YANLIŞ — moov atom sorunu yok, faststart bu sorunu çözmez.`)
    console.log(`Sıradaki: telemetry verisini bekle, başka hipotezleri incele (A1, A2, B2).`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('\n❌ Script hatası:', err)
  prisma.$disconnect()
  process.exit(1)
})
