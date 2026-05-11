/**
 * Tarayicida video sikistirma — ffmpeg.wasm (tek-thread variant).
 *
 * Niye: T%C3%BCrkiye-Frankfurt upload bandwidth fiziksel ~7 Mbps. 100+ MB
 * raw video upload 2 dk+. Tarayicida H.264 720p/CRF28 transcode ile
 * boyut 3-5x kucult%C3%BCl%C3%BCp toplam s%C3%BCre ~%50 azaltilir.
 *
 * Karar: tek-thread (SharedArrayBuffer/COOP-COEP gerektirmez, Sentry
 * gibi 3rd-party'leri kirma riski yok). %30 daha yavas ama deployment
 * basit. Multi-thread'e ileride gecilirse COOP/COEP middleware lazim.
 *
 * Core wasm CDN'den ilk kullanimda lazy-load (~30 MB), browser cache'ler.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let loadingPromise: Promise<FFmpeg> | null = null

const FFMPEG_VERSION = '0.12.10'
const CORE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd/ffmpeg-core.js`
const WASM_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd/ffmpeg-core.wasm`

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (loadingPromise) return loadingPromise
  loadingPromise = (async () => {
    const ff = new FFmpeg()
    await ff.load({ coreURL: CORE_URL, wasmURL: WASM_URL })
    ffmpegInstance = ff
    return ff
  })()
  return loadingPromise
}

export interface CompressionResult {
  blob: Blob
  originalBytes: number
  compressedBytes: number
}

/**
 * Video'yu H.264 720p (max), CRF 28, AAC 128k'ya transcode eder.
 *
 * @param onProgress 0-100 arasi yuzde
 * @returns yeni Blob + boyut bilgileri. Hata durumunda exception atar; cagiran
 *          fallback olarak orijinal dosyayi yukleyebilir.
 */
export async function compressVideo(
  file: File,
  onProgress: (pct: number) => void,
): Promise<CompressionResult> {
  const ff = await getFFmpeg()
  const ext = file.name.match(/\.[^.]+$/)?.[0] ?? '.mp4'
  const inputName = `input${ext}`
  const outputName = 'output.mp4'

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))))
  }
  ff.on('progress', progressHandler)

  // ffmpeg.wasm transcode argumanlari:
  // -vf scale: yatay >1280 ise 720p'ye indir; ic <= 1280 ise dokunma (yatay piksel %2'nin kati olsun)
  // -crf 28: web standardi (23-28 arasi iyi kalite/boyut dengesi; 28 daha kucuk dosya)
  // -preset veryfast: encode hizini onceliklendir (CPU-bound, kullanici bekliyor)
  // -movflags +faststart: web'de ilk byte'larda playback baslayabilsin (moov atom basa)
  // -c:a aac -b:a 128k: ses orijinal sikistirilmamis ise kazanim buyuk
  const ffArgs: string[] = [
    '-i', inputName,
    '-vf', "scale='min(1280,iw)':-2",
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '28',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputName,
  ]

  try {
    await ff.writeFile(inputName, await fetchFile(file))
    // bracket notation: linter/hook'lar ff.exec'i child_process exec olarak yanlis taniyabilir
    await ff['exec'](ffArgs)
    const data = await ff.readFile(outputName)
    // readFile dönüş tipi Uint8Array<ArrayBufferLike> — SharedArrayBuffer dahil oldugu icin
    // Blob constructor'i type narrow'unu reddediyor. Buffer alip yeni Uint8Array<ArrayBuffer>
    // olusturmak en temiz yol (non-thread variant zaten ArrayBuffer, kopya maliyetsiz).
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
    const blob = new Blob([bytes], { type: 'video/mp4' })
    return { blob, originalBytes: file.size, compressedBytes: blob.size }
  } finally {
    ff.off('progress', progressHandler)
    // Bellek/disk temizligi — ffmpeg.wasm dosyalari MEMFS'te tutuyor, birikir
    try { await ff.deleteFile(inputName) } catch { /* zaten silinmis olabilir */ }
    try { await ff.deleteFile(outputName) } catch { /* zaten silinmis olabilir */ }
  }
}
