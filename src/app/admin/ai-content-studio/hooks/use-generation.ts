'use client'

import { useState, useCallback, useRef } from 'react'
import type { GenerationJob, OutputFormat } from '../types'
import { POLLING_INTERVAL_MS } from '../constants'
import { getFormatConfig } from '../lib/format-config'

export function useGeneration() {
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startGeneration = useCallback(async (params: {
    format: OutputFormat
    audioFormat?: string
    videoStyle?: string
    documentText: string
    documentTitle: string
    customInstructions?: string
  }) => {
    setError(null)
    setStarting(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Üretim başlatılamadı.')
      }
      const { jobId } = await res.json()

      setJob({
        id: jobId,
        title: params.documentTitle,
        format: params.format,
        status: 'queued',
        progress: 0,
        prompt: params.customInstructions ?? '',
        settings: {},
        documentIds: [],
        createdAt: new Date().toISOString(),
      })

      // Polling başlat
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/admin/ai-content-studio/status/${jobId}`)
          if (!statusRes.ok) return
          const status = await statusRes.json()

          setJob((prev) => {
            if (!prev) return prev
            const fallbackType = getFormatConfig(prev.format).resultType
            return {
              ...prev,
              status: status.status,
              progress: status.progress,
              resultType: status.resultType ?? fallbackType,
              error: status.error,
            }
          })

          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling()
          }
        } catch {
          // Ağ hatalarında polling devam eder
        }
      }, POLLING_INTERVAL_MS)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setStarting(false)
    }
  }, [stopPolling])

  /** Mevcut bir job'u yükle ve gerekirse polling başlat (sayfa yenileme sonrası) */
  const resumeJob = useCallback((existingJob: GenerationJob) => {
    stopPolling()
    setJob(existingJob)
    setError(null)

    // Aktif job'sa polling başlat
    if (existingJob.status === 'queued' || existingJob.status === 'processing') {
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/admin/ai-content-studio/status/${existingJob.id}`)
          if (!statusRes.ok) return
          const status = await statusRes.json()

          setJob((prev) => {
            if (!prev) return prev
            const fallbackType = getFormatConfig(prev.format).resultType
            return {
              ...prev,
              status: status.status,
              progress: status.progress,
              resultType: status.resultType ?? fallbackType,
              error: status.error,
            }
          })

          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling()
          }
        } catch {
          // Ağ hatalarında polling devam eder
        }
      }, POLLING_INTERVAL_MS)
    }
  }, [stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setJob(null)
    setError(null)
  }, [stopPolling])

  return { job, starting, error, startGeneration, resumeJob, reset }
}
