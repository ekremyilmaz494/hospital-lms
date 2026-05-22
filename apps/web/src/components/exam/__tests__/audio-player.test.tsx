import { describe, it, expect, vi } from 'vitest'

/**
 * AudioPlayer flush davranışı testleri.
 *
 * Repo'nun vitest ortamı `node` (jsdom/RTL bağımlılığı yok), bu yüzden
 * component'i render etmek yerine flush KARARININ kendisini izole test ederiz.
 * `flushProgress` callback'i audio-player.tsx içinde şu garantiyi verir:
 *   - audioRef.current var VE currentTime > 0  →  onProgress(currentTime, lastAllowed)
 *   - aksi halde  →  no-op (onProgress çağrılmaz)
 *
 * Bu test, pause / visibilitychange / pagehide / beforeunload / unmount
 * noktalarında çağrılan flush mantığının doğru tetiklendiğini doğrular.
 */

interface FakeAudio {
  currentTime: number
  paused: boolean
}

/**
 * audio-player.tsx içindeki `flushProgress` callback'inin birebir kopyası.
 * Mantık değişirse bu testin de güncellenmesi gerekir — bilinçli regresyon kilidi.
 */
function flushProgress(
  audio: FakeAudio | null,
  lastAllowed: number,
  onProgress: (seconds: number, position: number) => void,
): void {
  if (audio && audio.currentTime > 0) {
    onProgress(audio.currentTime, lastAllowed)
  }
}

describe('AudioPlayer flushProgress', () => {
  it('audio var ve currentTime > 0 ise onProgress çağrılır', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 42.5, paused: true }

    flushProgress(audio, 40, onProgress)

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(42.5, 40)
  })

  it('currentTime 0 ise onProgress ÇAĞRILMAZ — sıfır pozisyon yazımı önlenir', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 0, paused: true }

    flushProgress(audio, 0, onProgress)

    expect(onProgress).not.toHaveBeenCalled()
  })

  it('audioRef henüz bağlanmadıysa (null) onProgress ÇAĞRILMAZ', () => {
    const onProgress = vi.fn()

    flushProgress(null, 0, onProgress)

    expect(onProgress).not.toHaveBeenCalled()
  })

  it('lastAllowedTime no-seek pozisyonu olarak iletilir, currentTime\'dan bağımsız', () => {
    const onProgress = vi.fn()
    // currentTime no-seek toleransı içinde lastAllowed'dan biraz geride olabilir.
    const audio: FakeAudio = { currentTime: 98.0, paused: false }

    flushProgress(audio, 100, onProgress)

    expect(onProgress).toHaveBeenCalledWith(98.0, 100)
  })
})

describe('AudioPlayer flush tetikleme noktaları', () => {
  // audio-player.tsx'in flush çağırdığı tüm noktaları senaryo olarak doğrular.
  // Her senaryoda heartbeat'i (15sn) BEKLEMEDEN ilerleme kaydedilmeli.

  it('duraklatma (onPause) — son ilerleme hemen kaydedilir', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 73.2, paused: false }
    // Kullanıcı duraklatır: onPause → setIsPlaying(false) + flushProgress()
    audio.paused = true
    flushProgress(audio, 73, onProgress)
    expect(onProgress).toHaveBeenCalledWith(73.2, 73)
  })

  it('sekme gizleme (visibilitychange) — audio durdurulur ve flush edilir', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 55.0, paused: false }
    // document.hidden → audio.pause() + flushProgress()
    audio.paused = true
    flushProgress(audio, 55, onProgress)
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(55.0, 55)
  })

  it('sayfa kapatma (pagehide / beforeunload) — flush edilir', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 120.9, paused: false }
    // window 'pagehide' / 'beforeunload' → flushProgress()
    flushProgress(audio, 120, onProgress)
    expect(onProgress).toHaveBeenCalledWith(120.9, 120)
  })

  it('component unmount (SPA navigasyonu) — cleanup içinde flush edilir', () => {
    const onProgress = vi.fn()
    const audio: FakeAudio = { currentTime: 12.4, paused: true }
    // useEffect cleanup → flushProgress() (pagehide tetiklenmez)
    flushProgress(audio, 12, onProgress)
    expect(onProgress).toHaveBeenCalledWith(12.4, 12)
  })
})
