/**
 * Client-side video thumbnail üretici.
 * Dosyayı RAM'de açar, belirli saniyeye seek eder, o kareyi JPEG blob olarak döndürür.
 * Hata/desteklenmeyen codec durumunda null döner (upload akışını bozmaz).
 */
export async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    let settled = false

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.remove()
    }

    const finish = (blob: Blob | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(blob)
    }

    // Güvenlik: 10sn içinde tamamlanmazsa vazgeç
    const timeout = setTimeout(() => finish(null), 10000)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = url

    video.onloadedmetadata = () => {
      const targetTime = video.duration && video.duration > 3 ? 1.5 : (video.duration || 1) / 2
      video.currentTime = Math.min(targetTime, video.duration - 0.1)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxW = 640
        const ratio = video.videoWidth > 0 ? video.videoHeight / video.videoWidth : 9 / 16
        canvas.width = Math.min(maxW, video.videoWidth || maxW)
        canvas.height = Math.round(canvas.width * ratio)
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(null)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            clearTimeout(timeout)
            finish(blob)
          },
          'image/jpeg',
          0.75,
        )
      } catch {
        clearTimeout(timeout)
        finish(null)
      }
    }

    video.onerror = () => {
      clearTimeout(timeout)
      finish(null)
    }
  })
}
