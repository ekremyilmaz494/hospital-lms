/**
 * Offline Form Submit Kuyruğu — IndexedDB + reconnect flush.
 *
 * Personel zayıf bağlantıda form doldururken veri kaybını önler.
 * Desteklenen endpoint'ler:
 *  - /api/feedback/submit
 *  - /api/staff/smg/my-points (POST)
 *
 * Kullanım:
 *   enqueueRequest({ url, method, body }) — kuyruğa ekle, hemen dene.
 *   flushQueue() — manuel flush (uygulama açıldığında / online event'inde çağır).
 *
 * NOT: iOS Safari'de BackgroundSync desteklenmez. Fallback: focus/online event'te flush.
 * Kuyruk üstte kalır — çevrimiçi olunca otomatik gönderilir, kaybolmaz.
 */
'use client'

import Dexie, { type Table } from 'dexie'

export interface QueuedRequest {
  id?: number
  url: string
  method: string
  body: string
  headers: Record<string, string>
  createdAt: number
  attemptCount: number
}

class OfflineQueueDB extends Dexie {
  requests!: Table<QueuedRequest>

  constructor() {
    super('lms_offline_queue')
    this.version(1).stores({
      requests: '++id, url, createdAt',
    })
  }
}

let _db: OfflineQueueDB | null = null

function getDB(): OfflineQueueDB {
  if (!_db) _db = new OfflineQueueDB()
  return _db
}

/** İsteği kuyruğa ekle ve hemen göndermeyi dene. */
export async function enqueueRequest(
  url: string,
  method: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const db = getDB()
  const entry: QueuedRequest = {
    url,
    method: method.toUpperCase(),
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    createdAt: Date.now(),
    attemptCount: 0,
  }

  // Çevrimiçiyse direkt dene, yoksa sadece kuyruğa ekle
  if (navigator.onLine) {
    try {
      const res = await fetch(url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      })
      if (res.ok) return // Başarılı — kuyruğa gerek yok
    } catch {
      // Network error — kuyruğa al
    }
  }

  await db.requests.add(entry)
}

/** Kuyruktaki tüm istekleri sırayla gönder. Başarılıları sil. */
export async function flushQueue(): Promise<void> {
  if (!navigator.onLine) return

  const db = getDB()
  const items = await db.requests.orderBy('createdAt').toArray()
  if (items.length === 0) return

  for (const item of items) {
    // 5 denemeden fazlaysa eski kaydı sil (stale veri)
    if (item.attemptCount >= 5) {
      await db.requests.delete(item.id!)
      continue
    }

    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })

      if (res.ok || res.status === 409) {
        // 409 Conflict = zaten gönderilmiş (duplicate) — sil
        await db.requests.delete(item.id!)
      } else if (res.status >= 400 && res.status < 500) {
        // Client error (400, 422 vb) — yeniden denemenin anlamı yok, sil
        await db.requests.delete(item.id!)
      } else {
        // Geçici hata (5xx) — deneme sayısını arttır
        await db.requests.update(item.id!, { attemptCount: item.attemptCount + 1 })
      }
    } catch {
      await db.requests.update(item.id!, { attemptCount: item.attemptCount + 1 })
    }
  }
}

/** Kuyruktaki bekleyen istek sayısı. */
export async function getPendingCount(): Promise<number> {
  return getDB().requests.count()
}
