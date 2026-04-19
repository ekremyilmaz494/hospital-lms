'use client'

import { useCallback, useState } from 'react'
import { useToast } from '@/components/shared/toast'
import type { Certificate, FilterState } from '../_types'

export type BundleFormat = 'list' | 'bundle'

export interface GroupDownloadParams {
  trainingId: string
  format: BundleFormat
  status?: FilterState['status']
  search?: string
  category?: string
}

function buildExportUrl(params: {
  type: 'certificates'
  trainingId?: string
  format?: BundleFormat
  status?: FilterState['status']
  search?: string
  category?: string
}): string {
  const qs = new URLSearchParams()
  qs.set('type', params.type)
  if (params.trainingId) qs.set('trainingId', params.trainingId)
  if (params.format) qs.set('format', params.format)
  if (params.status && params.status !== 'all') qs.set('status', params.status)
  if (params.search) qs.set('search', params.search)
  if (params.category) qs.set('category', params.category)
  return `/api/admin/export/pdf?${qs.toString()}`
}

async function downloadBlobFrom(url: string, filename: string, onErr: (msg: string) => void): Promise<boolean> {
  const res = await fetch(url)
  if (!res.ok) {
    const msg = res.status === 429
      ? 'Çok fazla indirme isteği. Lütfen 1 dakika bekleyin.'
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
  a.click()
  URL.revokeObjectURL(blobUrl)
  return true
}

export function useCertPdf() {
  const { toast } = useToast()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const downloadSingle = useCallback(async (cert: Certificate) => {
    setPendingKey(`single:${cert.id}`)
    try {
      const ok = await downloadBlobFrom(
        `/api/certificates/${cert.id}/pdf`,
        `sertifika-${cert.certificateCode}.pdf`,
        (msg) => toast(msg, 'error'),
      )
      if (ok) toast('Sertifika PDF olarak indirildi', 'success')
    } finally {
      setPendingKey(null)
    }
  }, [toast])

  const downloadGroup = useCallback(async (params: GroupDownloadParams) => {
    const key = `group:${params.trainingId}:${params.format}`
    setPendingKey(key)
    try {
      const url = buildExportUrl({ type: 'certificates', ...params })
      const filename = params.format === 'bundle'
        ? `sertifika-paketi-${params.trainingId}.pdf`
        : `sertifika-listesi-${params.trainingId}.pdf`
      const ok = await downloadBlobFrom(url, filename, (msg) => toast(msg, 'error'))
      if (ok) toast('İndirme tamamlandı', 'success')
    } finally {
      setPendingKey(null)
    }
  }, [toast])

  const downloadAll = useCallback(async (filters: FilterState) => {
    setPendingKey('all')
    try {
      const url = buildExportUrl({
        type: 'certificates',
        format: 'list',
        status: filters.status,
        search: filters.search,
        category: filters.category || undefined,
        trainingId: filters.trainingId || undefined,
      })
      const ok = await downloadBlobFrom(url, 'sertifikalar.pdf', (msg) => toast(msg, 'error'))
      if (ok) toast('İndirme tamamlandı', 'success')
    } finally {
      setPendingKey(null)
    }
  }, [toast])

  return {
    pendingKey,
    isPending: (key: string) => pendingKey === key,
    downloadSingle,
    downloadGroup,
    downloadAll,
  }
}
