'use client'

import { useCallback, useState } from 'react'
import { useToast } from '@/components/shared/toast'

/**
 * Tek bir feedback yanıtı için PDF indirme hook'u.
 *
 * Pattern: `use-cert-pdf.ts`'in tekil indirme akışı — generic blob downloader
 * + toast geri bildirim + per-response loading state. Aynı response birden
 * fazla indirme tetiklenmesin diye `pendingId` kilidi.
 */
async function downloadBlobFrom(
  url: string,
  filename: string,
  onErr: (msg: string) => void,
): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok) {
    const msg = res.status === 429
      ? 'Çok fazla indirme isteği. Lütfen 1 dakika bekleyin.'
      : res.status === 404
        ? 'Yanıt bulunamadı veya silinmiş.'
        : res.status === 400
          ? (await res.json().catch(() => null))?.error ?? 'Geçersiz istek'
          : 'PDF oluşturulamadı'
    onErr(msg)
    return false
  }
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
  return true
}

/** Türkçe karakterleri ASCII'ye indirip dosya adı için temizler. */
function safeFileSegment(s: string, maxLen = 40): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
    ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
  }
  return s.replace(/[çÇğĞıİöÖşŞüÜ]/g, c => map[c] ?? c)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen) || 'egitim'
}

export function useFeedbackPdf() {
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [bulkPendingTrainingId, setBulkPendingTrainingId] = useState<string | null>(null)

  const downloadResponsePdf = useCallback(async (responseId: string) => {
    if (pendingId === responseId) return
    setPendingId(responseId)
    try {
      const ok = await downloadBlobFrom(
        `/api/admin/feedback/responses/${responseId}/pdf`,
        `geri-bildirim-${responseId.slice(0, 8)}.pdf`,
        (msg) => toast(msg, 'error'),
      )
      if (ok) toast('PDF indirildi', 'success')
    } finally {
      setPendingId(null)
    }
  }, [toast, pendingId])

  /**
   * Bir eğitime ait tüm feedback yanıtlarını ZIP olarak indirir.
   * Endpoint bellek koruması için 200 yanıt ile sınırlandırılmıştır.
   */
  const downloadAllForTraining = useCallback(async (trainingId: string, trainingTitle: string) => {
    if (bulkPendingTrainingId === trainingId) return
    setBulkPendingTrainingId(trainingId)
    try {
      const filename = `geri-bildirimler-${safeFileSegment(trainingTitle)}.zip`
      const ok = await downloadBlobFrom(
        `/api/admin/feedback/responses/by-training/${trainingId}/pdf-zip`,
        filename,
        (msg) => toast(msg, 'error'),
      )
      if (ok) toast('Yanıtlar ZIP olarak indirildi', 'success')
    } finally {
      setBulkPendingTrainingId(null)
    }
  }, [toast, bulkPendingTrainingId])

  return {
    pendingId,
    isPending: (id: string) => pendingId === id,
    downloadResponsePdf,
    bulkPendingTrainingId,
    isBulkPending: (trainingId: string) => bulkPendingTrainingId === trainingId,
    downloadAllForTraining,
  }
}
