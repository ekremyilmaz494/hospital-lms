import { describe, it, expect } from 'vitest'

/**
 * exam/[id]/videos/page.tsx — karar mantığı regresyon korumaları.
 *
 * Repodaki vitest ortamı `environment: 'node'` (jsdom/testing-library yok),
 * bu yüzden tam component render edilemez. Bunun yerine sayfanın iki kritik
 * karar predicate'i — bileşendeki kodla BİREBİR aynı — saf fonksiyon olarak
 * burada doğrulanır:
 *
 *   Y2 — Boş video URL'i sessiz ölü oynatıcı:
 *        `currentVideo` var ama `currentVideo.url` boş/falsy ise oynatıcı
 *        render edilmeden hata durumu gösterilmeli. Bileşendeki guard:
 *        `if (!currentVideo.url) { return <hata UI> }`
 *
 *   O5 — PDF gating tutarsızlığı:
 *        "Son Sınava Git" / `allCompleted` yalnız video/ses (mediaItems)
 *        içeriğine bağlı, PDF opsiyonel. Bileşendeki ifade:
 *        `const allCompleted = mediaItems.every((v) => v.completed)`
 */

interface VideoItem {
  id: string
  title: string
  url: string
  duration: number
  contentType?: 'video' | 'pdf' | 'audio'
  pageCount?: number | null
  documentUrl?: string
  completed: boolean
  lastPosition?: number
}

// ── Bileşendeki predicate'lerin birebir kopyası ──────────────────────────

/** Y2: `currentVideo.url` boş/falsy ise oynatıcı yerine hata UI'ı gösterilir. */
function shouldShowEmptyUrlError(currentVideo: VideoItem | undefined): boolean {
  if (!currentVideo) return false // !currentVideo → ayrı `return null` dalı
  return !currentVideo.url
}

/** O5: "Son Sınava Git" gating'i — yalnız video/ses içeriği (PDF hariç). */
function computeAllCompleted(videosData: VideoItem[]): boolean {
  const mediaItems = videosData.filter((v) => v.contentType !== 'pdf')
  return mediaItems.every((v) => v.completed)
}

function makeItem(overrides: Partial<VideoItem>): VideoItem {
  return {
    id: 'v1',
    title: 'İçerik',
    url: 'https://cdn.example.com/signed/v1.mp4',
    duration: 120,
    contentType: 'video',
    completed: false,
    ...overrides,
  }
}

// ════════════════════════════════════════════════════════════════════════
// Y2 — Boş video URL → hata UI
// ════════════════════════════════════════════════════════════════════════

describe('Y2 — boş URL hata durumu', () => {
  it('video içeriğinde url boş string → hata gösterilir', () => {
    const video = makeItem({ contentType: 'video', url: '' })
    expect(shouldShowEmptyUrlError(video)).toBe(true)
  })

  it('audio içeriğinde url boş string → hata gösterilir', () => {
    const audio = makeItem({ contentType: 'audio', url: '' })
    expect(shouldShowEmptyUrlError(audio)).toBe(true)
  })

  it('pdf içeriğinde ana url boş string → hata gösterilir', () => {
    const pdf = makeItem({ contentType: 'pdf', url: '', pageCount: 10 })
    expect(shouldShowEmptyUrlError(pdf)).toBe(true)
  })

  it('pdf — ana url boş ama documentUrl dolu → yine hata (documentUrl\'e bakılmaz)', () => {
    // documentUrl ayrı bir alan; Y2 yalnız ana `url`\'i kontrol eder.
    const pdf = makeItem({
      contentType: 'pdf',
      url: '',
      documentUrl: 'https://cdn.example.com/signed/doc.pdf',
    })
    expect(shouldShowEmptyUrlError(pdf)).toBe(true)
  })

  it('geçerli signed URL → hata gösterilmez (oynatıcı render edilir)', () => {
    const video = makeItem({ url: 'https://cdn.example.com/signed/ok.mp4' })
    expect(shouldShowEmptyUrlError(video)).toBe(false)
  })

  it('currentVideo undefined → bu dal tetiklenmez (ayrı `return null` dalı)', () => {
    expect(shouldShowEmptyUrlError(undefined)).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════
// O5 — PDF gating: "Son Sınava Git" yalnız video/ses tamamlanınca açılır
// ════════════════════════════════════════════════════════════════════════

describe('O5 — allCompleted yalnız mediaItems\'a bağlı (PDF opsiyonel)', () => {
  it('tek video tamamlanmamış → allCompleted false', () => {
    const data = [makeItem({ id: 'v1', contentType: 'video', completed: false })]
    expect(computeAllCompleted(data)).toBe(false)
  })

  it('tek video tamamlanmış → allCompleted true', () => {
    const data = [makeItem({ id: 'v1', contentType: 'video', completed: true })]
    expect(computeAllCompleted(data)).toBe(true)
  })

  it('video tamamlandı + PDF tamamlanmadı → allCompleted true (PDF opsiyonel)', () => {
    // Önceki bug: tüm içerikler (PDF dahil) aranıyordu → false dönüyordu.
    const data = [
      makeItem({ id: 'v1', contentType: 'video', completed: true }),
      makeItem({ id: 'p1', contentType: 'pdf', completed: false, pageCount: 5 }),
    ]
    expect(computeAllCompleted(data)).toBe(true)
  })

  it('video + ses ikisi de tamamlandı, PDF değil → allCompleted true', () => {
    const data = [
      makeItem({ id: 'v1', contentType: 'video', completed: true }),
      makeItem({ id: 'a1', contentType: 'audio', completed: true }),
      makeItem({ id: 'p1', contentType: 'pdf', completed: false }),
    ]
    expect(computeAllCompleted(data)).toBe(true)
  })

  it('video tamamlandı ama ses tamamlanmadı → allCompleted false', () => {
    const data = [
      makeItem({ id: 'v1', contentType: 'video', completed: true }),
      makeItem({ id: 'a1', contentType: 'audio', completed: false }),
    ]
    expect(computeAllCompleted(data)).toBe(false)
  })

  it('yalnızca PDF içeren eğitim → mediaItems boş → allCompleted true (sınav açık)', () => {
    // Boş mediaItems\'ta every() true döner — PDF-only eğitimde son sınav engellenmez.
    const data = [
      makeItem({ id: 'p1', contentType: 'pdf', completed: false }),
      makeItem({ id: 'p2', contentType: 'pdf', completed: false }),
    ]
    expect(computeAllCompleted(data)).toBe(true)
  })

  it('contentType belirtilmemiş içerik PDF değil sayılır (mediaItems\'a dahil)', () => {
    // `contentType !== 'pdf'` — undefined !== 'pdf' true → media kabul edilir.
    const data = [makeItem({ id: 'v1', contentType: undefined, completed: false })]
    expect(computeAllCompleted(data)).toBe(false)
  })
})
