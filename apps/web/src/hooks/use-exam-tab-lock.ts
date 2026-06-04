'use client'

import { useEffect, useState } from 'react'

/**
 * Aynı sınav denemesinin (attempt) birden fazla sekmede açılmasını engelleyen kilit.
 *
 * Neden var: İki sekme aynı soruyu cevaplarsa `save-answer` upsert'i son yazanı
 * kazandırır — personel A sekmesinde gördüğü cevabı değil, B sekmesindeki cevabı
 * göndermiş olur (sessiz veri kaybı). Bu hook sekmeler arası deterministik bir
 * sahiplik kuralı uygular: **ilk açılan sekme** denetimi korur, sonraki sekmeler
 * kendilerini `blocked` durumuna alır.
 *
 * Mekanizma: `localStorage` (kalıcı kilit kaydı + staleness) + `BroadcastChannel`
 * (anlık mesaj) + `storage` event (BroadcastChannel yoksa yedek bildirim).
 *
 * Kapsam sınırı (D3 — WONTFIX, bilinçli): Bu bir UX guard'ı, GÜVENLİK SINIRI DEĞİL.
 * DevTools'tan `localStorage` anahtarı silinerek baypas edilebilir; kabul edilmiştir.
 * Gerçek sınav bütünlüğü SUNUCUDA: save-answer last-write-wins + 30sn cevap kilidi +
 * skorun DB'den hesaplanması. Önerilen sequence-counter sertleştirmesi, aşağıdaki
 * heartbeat'in meşru crash-recovery'sini (sahip sekme çökünce kilidi devralma) bozma
 * riski taşıdığından EKLENMEDİ — net güvenlik faydası yok, regresyon riski var.
 */

/** Stale kilit eşiği — bu süreden eski heartbeat'li kilit terk edilmiş sayılır. */
const STALE_MS = 15_000
/** Aktif sekmenin kilit kaydını tazeleme aralığı. */
const HEARTBEAT_MS = 5_000
const LOCK_KEY_PREFIX = 'exam-tab-lock:'

export type ExamTabLockStatus = 'pending' | 'active' | 'blocked'

/** Bir sekmenin sınav üzerindeki sahiplik talebi. */
export interface ExamTabClaim {
  /** Sekmeye özgü rastgele kimlik. */
  tabId: string
  /** Sekmenin sahipliği ilk talep ettiği an (epoch ms). */
  claimedAt: number
}

/** `localStorage`'da saklanan kilit kaydı — claim + son heartbeat zamanı. */
interface ExamTabLockRecord extends ExamTabClaim {
  /** Son heartbeat zamanı (staleness tespiti için). */
  ts: number
}

/**
 * İki sahiplik talebi çakıştığında **bu sekmenin** bloklanıp bloklanmayacağına karar verir.
 *
 * Kural: önce claim eden sekme denetimi korur (deterministik). Aynı `claimedAt`
 * değerinde `tabId` string karşılaştırması tiebreak yapar — rastlantısal ama her iki
 * sekmede de aynı sonucu verir, böylece iki sekme asla birbirini bloklamaz.
 *
 * @param mine - Bu sekmenin talebi.
 * @param incoming - Karşı sekmeden gelen talep.
 * @returns Karşı sekme önceliğe sahipse `true` (bu sekme bloklanmalı).
 */
export function shouldBlock(mine: ExamTabClaim, incoming: ExamTabClaim): boolean {
  if (incoming.tabId === mine.tabId) return false
  if (incoming.claimedAt !== mine.claimedAt) return incoming.claimedAt < mine.claimedAt
  return incoming.tabId < mine.tabId
}

/**
 * Sınav denemesi için sekme kilidi kurar.
 *
 * @param attemptId - Aktif attempt id'si. `null` ise kilit uygulanmaz (`active` döner) —
 *   attempt henüz başlamadıysa akış engellenmez.
 * @returns `{ status }` — `pending` (ilk değerlendirme), `active` (bu sekme sahip),
 *   `blocked` (sınav başka sekmede açık).
 */
export function useExamTabLock(attemptId: string | null): { status: ExamTabLockStatus } {
  const [status, setStatus] = useState<ExamTabLockStatus>('pending')

  useEffect(() => {
    if (!attemptId || typeof window === 'undefined') {
      // Kilit uygulanamıyorsa (SSR / attempt yok) akışı engelleme.
      setStatus('active')
      return
    }

    const key = LOCK_KEY_PREFIX + attemptId
    const myClaim: ExamTabClaim = {
      tabId: Math.random().toString(36).slice(2) + Date.now().toString(36),
      claimedAt: Date.now(),
    }

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(key) : null
    let blocked = false

    const readLock = (): ExamTabLockRecord | null => {
      try {
        const raw = localStorage.getItem(key)
        return raw ? (JSON.parse(raw) as ExamTabLockRecord) : null
      } catch {
        return null
      }
    }
    const isFresh = (rec: ExamTabLockRecord | null): rec is ExamTabLockRecord =>
      !!rec && Date.now() - rec.ts < STALE_MS
    const writeLock = () => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...myClaim, ts: Date.now() } satisfies ExamTabLockRecord))
      } catch {
        /* localStorage kapalı/dolu — kilit best-effort */
      }
    }
    const releaseLock = () => {
      const rec = readLock()
      if (rec && rec.tabId === myClaim.tabId) {
        try {
          localStorage.removeItem(key)
        } catch {
          /* ignore */
        }
      }
    }
    const block = () => {
      if (blocked) return
      blocked = true
      releaseLock()
      setStatus('blocked')
    }

    /** Karşı bir sekmenin claim'i geldiğinde sahipliği yeniden değerlendir. */
    const handleClaim = (incoming: ExamTabClaim) => {
      if (blocked || incoming.tabId === myClaim.tabId) return
      if (shouldBlock(myClaim, incoming)) {
        block()
      } else {
        // Bu sekme kazandı — geç gelen sekmenin beni görüp kendini bloklaması için
        // claim'i yeniden duyur ve kilidi sahiplen.
        writeLock()
        channel?.postMessage({ type: 'claim', claim: myClaim })
      }
    }

    // İlk değerlendirme: taze ve başkasına ait bir kilit var mı?
    const existing = readLock()
    if (
      isFresh(existing) &&
      existing.tabId !== myClaim.tabId &&
      shouldBlock(myClaim, { tabId: existing.tabId, claimedAt: existing.claimedAt })
    ) {
      block()
    } else {
      writeLock()
      setStatus('active')
      channel?.postMessage({ type: 'claim', claim: myClaim })
    }

    const onChannelMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; claim?: ExamTabClaim }
      if (data?.type === 'claim' && data.claim) handleClaim(data.claim)
    }
    channel?.addEventListener('message', onChannelMessage)

    // BroadcastChannel desteklenmeyen tarayıcılar için yedek: başka sekme kilidi
    // yazınca `storage` event tetiklenir.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return
      try {
        const rec = JSON.parse(e.newValue) as ExamTabLockRecord
        handleClaim({ tabId: rec.tabId, claimedAt: rec.claimedAt })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('storage', onStorage)

    // Heartbeat: aktif sekme kilidini taze tutar. Bloklu sekme ise sahip sekmenin
    // hâlâ canlı olup olmadığını kontrol eder — sahip çöktü/sekmeyi kapattıysa kilit
    // stale kalır ve bu sekme devralır. Aksi halde "diğer sekmeyi kapattım ama
    // buradan devam edemiyorum" kalıcı takılması yaşanırdı (yenileme gerekirdi).
    const heartbeat = setInterval(() => {
      if (!blocked) {
        writeLock()
        return
      }
      const current = readLock()
      if (!isFresh(current) || current.tabId === myClaim.tabId) {
        blocked = false
        myClaim.claimedAt = Date.now()
        writeLock()
        channel?.postMessage({ type: 'claim', claim: myClaim })
        setStatus('active')
      }
    }, HEARTBEAT_MS)

    const onPageHide = () => releaseLock()
    window.addEventListener('pagehide', onPageHide)

    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('pagehide', onPageHide)
      channel?.removeEventListener('message', onChannelMessage)
      if (!blocked) {
        releaseLock()
        channel?.postMessage({ type: 'release', claim: myClaim })
      }
      channel?.close()
    }
  }, [attemptId])

  return { status }
}
