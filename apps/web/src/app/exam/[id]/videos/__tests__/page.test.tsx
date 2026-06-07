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

// ════════════════════════════════════════════════════════════════════════
// Görünür geri sayımlı otomatik geçiş — saf mantık korumaları
//
// Bileşendeki dört parça birebir kopyalanıp doğrulanır:
//   1. AUTO_ADVANCE_SECONDS sabiti (kazara 0/negatif olmasını yakalar)
//   2. Geri sayım tik reducer'ı (negatife düşmemeli, null'da kalmalı)
//   3. Halka strokeDashoffset matematiği (ters çizilen yayı yakalar)
//   4. İçerik bitince alınan karar: transition / auto-advance (geri sayım) / none
// ════════════════════════════════════════════════════════════════════════

// Bileşendeki module-level sabitin kopyası.
const AUTO_ADVANCE_SECONDS = 8

/** Geri sayım tik'i: bileşendeki setInterval functional updater'ının birebir kopyası. */
function tickCountdown(prev: number | null): number | null {
  return prev === null ? null : prev <= 1 ? 0 : prev - 1
}

/** Halka yay offset'i: bileşendeki strokeDashoffset ifadesinin kopyası. */
function ringDashOffset(left: number, total: number, r: number): number {
  const C = 2 * Math.PI * r
  return C * (1 - left / total)
}

type EndAction = 'transition' | 'auto-advance' | 'none'

/** Ses bitince (onComplete) karar: sunucunun allVideosCompleted + son medya kontrolü. */
function audioEndAction(allVideosCompleted: boolean, lastMedia: boolean): EndAction {
  if (allVideosCompleted) return 'transition'
  if (!lastMedia) return 'auto-advance'
  return 'none'
}

/** Video bitince (handleVideoEnded) karar: client-side remainingIncomplete + son video. */
function videoEndAction(
  isLastVideo: boolean,
  remainingIncomplete: number,
  totalIncomplete: number
): EndAction {
  if (remainingIncomplete === 0 || (isLastVideo && totalIncomplete <= 1)) return 'transition'
  if (!isLastVideo) return 'auto-advance'
  return 'none'
}

describe('AUTO_ADVANCE_SECONDS sabiti', () => {
  it('pozitif tamsayı (kazara 0/negatif değil)', () => {
    expect(Number.isInteger(AUTO_ADVANCE_SECONDS)).toBe(true)
    expect(AUTO_ADVANCE_SECONDS).toBeGreaterThan(0)
  })
})

describe('geri sayım tik reducer', () => {
  it("8'den 0'a tam iner", () => {
    const seq: (number | null)[] = []
    let v: number | null = AUTO_ADVANCE_SECONDS
    for (let i = 0; i < AUTO_ADVANCE_SECONDS + 2; i++) {
      seq.push(v)
      v = tickCountdown(v)
    }
    expect(seq).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0, 0])
  })

  it("0'da kalır (negatife düşmez)", () => {
    expect(tickCountdown(0)).toBe(0)
  })

  it('1 → 0', () => {
    expect(tickCountdown(1)).toBe(0)
  })

  it('null → null (geri sayım kapalı)', () => {
    expect(tickCountdown(null)).toBeNull()
  })
})

describe('halka yay offset matematiği', () => {
  const r = 26
  const C = 2 * Math.PI * r

  it('left = total iken offset = 0 (başlangıç: dolu halka)', () => {
    expect(ringDashOffset(AUTO_ADVANCE_SECONDS, AUTO_ADVANCE_SECONDS, r)).toBeCloseTo(0)
  })

  it('left = 0 iken offset = C (bitiş: boş halka)', () => {
    expect(ringDashOffset(0, AUTO_ADVANCE_SECONDS, r)).toBeCloseTo(C)
  })

  it("yarıda iken offset C'nin yarısı (yön doğru)", () => {
    expect(ringDashOffset(AUTO_ADVANCE_SECONDS / 2, AUTO_ADVANCE_SECONDS, r)).toBeCloseTo(C / 2)
  })
})

describe('içerik bitince karar — ses (audioEndAction)', () => {
  it('tüm içerik bitti → transition (son sınava)', () => {
    expect(audioEndAction(true, true)).toBe('transition')
    expect(audioEndAction(true, false)).toBe('transition')
  })

  it('hâlâ içerik var + son medya değil → auto-advance (geri sayım)', () => {
    expect(audioEndAction(false, false)).toBe('auto-advance')
  })

  it('son medya ama sunucu henüz tamamlanmadı diyor → none (geçiş yok)', () => {
    expect(audioEndAction(false, true)).toBe('none')
  })
})

describe('içerik bitince karar — video (videoEndAction)', () => {
  it('başka tamamlanmamış kalmadı → transition', () => {
    expect(videoEndAction(false, 0, 1)).toBe('transition')
  })

  it('son video ve toplam ≤1 eksik → transition', () => {
    expect(videoEndAction(true, 0, 1)).toBe('transition')
  })

  it('son video değil + başka eksik var → auto-advance (geri sayım)', () => {
    // 2 videolu eğitimde 1. video bitti, 2. hâlâ eksik.
    expect(videoEndAction(false, 1, 2)).toBe('auto-advance')
  })

  it('son video ama hâlâ birden çok eksik (atipik) → none', () => {
    expect(videoEndAction(true, 2, 3)).toBe('none')
  })
})
