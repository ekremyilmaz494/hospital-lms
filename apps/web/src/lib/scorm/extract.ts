import JSZip from 'jszip'
import { uploadBuffer, deleteObject, scormKey } from '@/lib/s3'
import { scormContentType } from './mime'
import { parseScormManifest, ScormManifestError, type ParsedManifest } from './manifest'

export class ScormExtractError extends Error {}

/** Aynı anda yürütülecek en fazla S3 upload sayısı (bellek/bağlantı dengesi). */
const UPLOAD_CONCURRENCY = 8
/** Zip-bomb koruması: en fazla girdi sayısı ve toplam açılmış boyut. */
const MAX_ENTRIES = 5000
const MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024 // 1 GB

export interface ExtractResult {
  manifest: ParsedManifest
  /** Yüklenen tüm S3 anahtarları — hata durumunda temizlik için. */
  uploadedKeys: string[]
  /** imsmanifest.xml'in tam S3 anahtarı → Training.scormManifestPath. */
  manifestKey: string
}

/**
 * Zip-slip guard: bir zip girdi adını güvenli, göreli bir yola normalize eder.
 * `..` segmenti / mutlak yol / sürücü harfi / boş sonuç → `null` (reddet).
 * Backslash'ler `/`'e çevrilir; `./` ve boş segmentler düşürülür.
 */
export function sanitizeEntryPath(rawPath: string): string | null {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return null
  const normalized = rawPath.replace(/\\/g, '/')
  // Mutlak yol veya Windows sürücü harfi → reddet.
  if (normalized.startsWith('/')) return null
  if (/^[A-Za-z]:/.test(normalized)) return null
  const segments = normalized.split('/')
  const safe: string[] = []
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') return null
    safe.push(seg)
  }
  if (safe.length === 0) return null
  return safe.join('/')
}

/** Bir görevi sınırlı eşzamanlılıkla çalıştır (basit havuz). */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const runners: Promise<void>[] = []
  const next = async (): Promise<void> => {
    const i = index++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(next())
  }
  await Promise.all(runners)
}

/**
 * Bir SCORM zip buffer'ını açar, imsmanifest.xml'i parse eder ve tüm dosyaları
 * `scorm/{orgId}/{trainingId}/...` altına S3'e yükler.
 *
 * Fırlatır (`ScormExtractError` / `ScormManifestError`): manifest yok, geçersiz
 * yapı, zip-slip girdisi, zip-bomb sınırları aşıldı. Çağıran hata durumunda
 * `uploadedKeys`'i temizlemekten sorumludur (kısmi yükleme kalırsa).
 */
export async function extractScormPackage(
  buffer: Buffer,
  opts: { orgId: string; trainingId: string },
): Promise<ExtractResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new ScormExtractError('Zip dosyası açılamadı (bozuk paket?)')
  }

  const fileEntries = Object.values(zip.files).filter((f) => !f.dir)
  if (fileEntries.length === 0) throw new ScormExtractError('Zip boş')
  if (fileEntries.length > MAX_ENTRIES) {
    throw new ScormExtractError(`Paket çok fazla dosya içeriyor (>${MAX_ENTRIES})`)
  }

  // imsmanifest.xml'i bul (köke en yakın olanı — en kısa yol).
  const manifestEntry = fileEntries
    .filter((f) => f.name.toLowerCase().endsWith('imsmanifest.xml'))
    .sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0]
  if (!manifestEntry) {
    throw new ScormManifestError('Paketin kökünde imsmanifest.xml bulunamadı')
  }

  const manifestSafePath = sanitizeEntryPath(manifestEntry.name)
  if (!manifestSafePath) {
    throw new ScormExtractError('Güvensiz manifest yolu')
  }
  const manifestXml = await manifestEntry.async('string')
  const manifest = parseScormManifest(manifestXml)

  const uploadedKeys: string[] = []
  let totalBytes = 0

  await runWithConcurrency(fileEntries, UPLOAD_CONCURRENCY, async (entry) => {
    const safePath = sanitizeEntryPath(entry.name)
    if (!safePath) {
      throw new ScormExtractError(`Güvensiz dosya yolu paketi reddetti: ${entry.name}`)
    }
    const data = await entry.async('nodebuffer')
    totalBytes += data.length
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new ScormExtractError('Açılmış paket boyutu sınırı aşıldı (zip-bomb?)')
    }
    const key = scormKey(opts.orgId, opts.trainingId, safePath)
    await uploadBuffer(key, data, scormContentType(safePath))
    uploadedKeys.push(key)
  })

  return {
    manifest,
    uploadedKeys,
    manifestKey: scormKey(opts.orgId, opts.trainingId, manifestSafePath),
  }
}

/** Kısmi/başarısız çıkarmada yüklenen tüm objeleri sil (best-effort). */
export async function cleanupScormKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => deleteObject(k)))
}
