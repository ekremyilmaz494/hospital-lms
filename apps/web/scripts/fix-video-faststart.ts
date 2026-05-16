/**
 * MP4 moov atom faststart düzeltici — S3'teki eğitim videolarını streaming
 * için optimize hale getirir. Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md B1 fix.
 *
 * Akış (her video için):
 *   1. Mevcut object'i `<key>.orig` olarak S3 içinde kopyala (yedek)
 *   2. S3'ten /tmp dizinine indir
 *   3. ffmpeg `-c copy -movflags +faststart` ile moov'u başa al (yeniden encode YOK)
 *   4. Düzeltilmiş dosyayı orijinal key'e geri yükle (overwrite)
 *   5. CloudFront invalidation tetikle (edge cache temizliği)
 *
 * Güvenlik:
 *   - DB'de videoKey değişmez → schema/kod tarafı dokunulmaz
 *   - `.orig` yedeği rollback için saklanır (manuel silme gerekir)
 *   - `-c copy` ile codec/bitrate korunur, sadece atom sırası değişir
 *
 * Kullanım:
 *   npx tsx scripts/fix-video-faststart.ts --dry-run         # plan göster, değişiklik yok
 *   npx tsx scripts/fix-video-faststart.ts --id <videoId>    # tek video
 *   npx tsx scripts/fix-video-faststart.ts --all             # tüm problemli video'lar
 *   npx tsx scripts/fix-video-faststart.ts --skip-invalidate # CF invalidation atla
 */

import { config as loadEnv } from 'dotenv'
import { existsSync, mkdtempSync, rmSync, statSync, createReadStream, createWriteStream } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

if (existsSync('.env.local')) loadEnv({ path: '.env.local' })
loadEnv()

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ALL = args.includes('--all')
const SKIP_INVALIDATE = args.includes('--skip-invalidate')
const idArgIdx = args.indexOf('--id')
const TARGET_ID = idArgIdx !== -1 ? args[idArgIdx + 1] : null

// Windows winget kurulumundan ffmpeg yolu (PATH henüz güncellenmemiş olabilir)
const FFMPEG_PATH = process.env.FFMPEG_PATH
  || 'C:\\Users\\pc\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe'

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

const cfDistroId = process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID
const cfClient = cfDistroId
  ? new CloudFrontClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

interface AtomInfo {
  type: string
  offset: number
  size: number
}

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

async function checkVideo(videoKey: string): Promise<'OK' | 'PROBLEM' | 'ERROR'> {
  try {
    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: videoKey,
      Range: 'bytes=0-1048575',
    })
    const res = await s3.send(cmd)
    if (!res.Body) return 'ERROR'
    const chunks: Buffer[] = []
    for await (const chunk of res.Body as Readable) chunks.push(chunk as Buffer)
    const buf = Buffer.concat(chunks)
    const { moov, mdat } = findAtoms(buf)
    if (moov === null) return 'PROBLEM'
    if (mdat === null) return 'OK'
    return moov < mdat ? 'OK' : 'PROBLEM'
  } catch {
    return 'ERROR'
  }
}

async function downloadObject(key: string, destPath: string): Promise<number> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  const res = await s3.send(cmd)
  if (!res.Body) throw new Error('S3 body boş')
  await pipeline(res.Body as Readable, createWriteStream(destPath))
  return statSync(destPath).size
}

async function uploadObject(key: string, srcPath: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: createReadStream(srcPath),
    ContentType: contentType,
    ContentLength: statSync(srcPath).size,
  })
  await s3.send(cmd)
}

async function copyInS3(srcKey: string, dstKey: string) {
  // CopySource URL-encoded olmalı — Türkçe karakter veya boşluk içeren key'ler için kritik
  const cmd = new CopyObjectCommand({
    Bucket: BUCKET,
    Key: dstKey,
    CopySource: encodeURIComponent(`${BUCKET}/${srcKey}`),
  })
  await s3.send(cmd)
}

async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return {
      size: Number(res.ContentLength ?? 0),
      contentType: res.ContentType ?? 'video/mp4',
    }
  } catch {
    return null
  }
}

function runFfmpegFaststart(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, [
      '-y', // overwrite output
      '-i', input,
      '-c', 'copy',
      '-movflags', '+faststart',
      output,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`))
    })
  })
}

async function invalidateCloudFront(paths: string[]) {
  if (!cfClient || !cfDistroId) {
    console.log('   ⏭️  CloudFront invalidation atlandı (DISTRIBUTION_ID yok)')
    return
  }
  if (SKIP_INVALIDATE) {
    console.log('   ⏭️  CloudFront invalidation atlandı (--skip-invalidate)')
    return
  }
  const items = paths.map((p) => (p.startsWith('/') ? p : `/${p}`))
  await cfClient.send(new CreateInvalidationCommand({
    DistributionId: cfDistroId,
    InvalidationBatch: {
      CallerReference: `faststart-${Date.now()}`,
      Paths: { Quantity: items.length, Items: items },
    },
  }))
  console.log(`   ✅ CloudFront invalidation gönderildi (${items.length} path)`)
}

interface VideoToFix {
  id: string
  title: string
  videoKey: string
}

async function fixVideo(v: VideoToFix): Promise<{ ok: boolean; reason?: string }> {
  console.log(`\n📹 ${v.title}`)
  console.log(`   ID: ${v.id}`)
  console.log(`   Key: ${v.videoKey}`)

  const head = await headObject(v.videoKey)
  if (!head) return { ok: false, reason: 'S3 object yok' }
  const sizeMb = (head.size / 1024 / 1024).toFixed(1)
  console.log(`   Boyut: ${sizeMb}MB`)

  if (DRY_RUN) {
    console.log('   [DRY-RUN] Düzeltilecek')
    return { ok: true }
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'faststart-'))
  const inputPath = join(tmpDir, 'in.mp4')
  const outputPath = join(tmpDir, 'out.mp4')

  try {
    // 1. Yedekle (S3 içi kopya, indirme yok → hızlı + ucuz)
    const backupKey = `${v.videoKey}.orig`
    console.log(`   1️⃣  Yedekleniyor → ${backupKey}`)
    await copyInS3(v.videoKey, backupKey)

    // 2. İndir
    console.log(`   2️⃣  İndiriliyor...`)
    const tStart = Date.now()
    const downloadedSize = await downloadObject(v.videoKey, inputPath)
    console.log(`      İndirildi (${(downloadedSize / 1024 / 1024).toFixed(1)}MB, ${Math.round((Date.now() - tStart) / 1000)}s)`)

    // 3. ffmpeg faststart
    console.log(`   3️⃣  ffmpeg faststart uygulanıyor...`)
    const tFf = Date.now()
    await runFfmpegFaststart(inputPath, outputPath)
    const newSize = statSync(outputPath).size
    console.log(`      Tamamlandı (${(newSize / 1024 / 1024).toFixed(1)}MB, ${Math.round((Date.now() - tFf) / 1000)}s)`)

    // 4. Yükle (overwrite)
    console.log(`   4️⃣  S3'e yükleniyor (overwrite)...`)
    const tUp = Date.now()
    await uploadObject(v.videoKey, outputPath, head.contentType)
    console.log(`      Yüklendi (${Math.round((Date.now() - tUp) / 1000)}s)`)

    // 5. Doğrula
    console.log(`   5️⃣  Sonuç doğrulanıyor...`)
    const verdict = await checkVideo(v.videoKey)
    if (verdict !== 'OK') {
      return { ok: false, reason: `Düzeltme sonrası hala ${verdict}` }
    }
    console.log(`      ✅ moov atom başta — streamable`)

    // 6. CloudFront invalidation
    console.log(`   6️⃣  CloudFront cache invalidation...`)
    await invalidateCloudFront([v.videoKey])

    return { ok: true }
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

async function main() {
  if (DRY_RUN) console.log('\n🟡 DRY-RUN modu — değişiklik yapılmayacak\n')

  const { prisma } = await import('../src/lib/prisma')

  const videos = await prisma.trainingVideo.findMany({
    select: { id: true, title: true, videoKey: true },
    ...(TARGET_ID ? { where: { id: TARGET_ID } } : {}),
  })

  console.log(`🔍 ${videos.length} video kontrol ediliyor...`)

  const toFix: VideoToFix[] = []
  for (const v of videos) {
    const verdict = await checkVideo(v.videoKey)
    if (verdict === 'PROBLEM') {
      toFix.push({ id: v.id, title: v.title ?? '(başlıksız)', videoKey: v.videoKey })
    }
  }

  if (toFix.length === 0) {
    console.log('\n✅ Düzeltilmesi gereken video yok.')
    await prisma.$disconnect()
    return
  }

  console.log(`\n⚠️  ${toFix.length} video düzeltilecek:`)
  for (const v of toFix) console.log(`   - [${v.id}] ${v.title}`)

  if (!ALL && !TARGET_ID && !DRY_RUN) {
    console.log('\n💡 Otomatik onay yok — devam etmek için --all veya --id <id> ekle')
    await prisma.$disconnect()
    return
  }

  const results: { id: string; title: string; ok: boolean; reason?: string }[] = []
  for (const v of toFix) {
    try {
      const r = await fixVideo(v)
      results.push({ id: v.id, title: v.title, ...r })
    } catch (err) {
      results.push({ id: v.id, title: v.title, ok: false, reason: (err as Error).message })
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log('📊 ÖZET')
  console.log('═'.repeat(80))
  const ok = results.filter((r) => r.ok).length
  const fail = results.length - ok
  console.log(`   ✅ Başarılı: ${ok}`)
  console.log(`   ❌ Başarısız: ${fail}`)
  if (fail > 0) {
    console.log('\nBaşarısızlar:')
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`   - [${r.id}] ${r.title}: ${r.reason}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('\n❌ Script hatası:', err)
  process.exit(1)
})
