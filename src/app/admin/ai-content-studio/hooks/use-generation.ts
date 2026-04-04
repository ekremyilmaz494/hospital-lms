'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { GenerationJob, ArtifactType } from '../types'
import {
  POLL_INTERVAL_FAST,
  POLL_INTERVAL_NORMAL,
  POLL_INTERVAL_SLOW,
  POLL_FAST_THRESHOLD,
  POLL_NORMAL_THRESHOLD,
} from '../constants'
import { useAiGenerationStore } from '@/store/ai-generation-store'

interface StartParams {
  notebookId: string
  artifactType: ArtifactType
  title: string
  instructions?: string
  settings?: Record<string, string>
}

interface UseGenerationReturn {
  job: GenerationJob | null
  starting: boolean
  error: string | null
  startGeneration: (params: StartParams) => Promise<string | null>
  loadJob: (jobId: string) => Promise<void>
  resumeJob: (existingJob: GenerationJob) => void
  reset: () => void
  isActive: boolean
  isCompleted: boolean
  isFailed: boolean
}

export function useGeneration(): UseGenerationReturn {
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const jobRef = useRef<GenerationJob | null>(null)

  const addStoreJob = useAiGenerationStore(s => s.addJob)

  // jobRef'i güncel tut (polling callback'inde stale closure engeli)
  useEffect(() => {
    jobRef.current = job
  }, [job])

  useEffect(() => () => stopPolling(), [])

  function getInterval(): number {
    const current = jobRef.current
    if (!current) return POLL_INTERVAL_FAST
    const age = Date.now() - new Date(current.createdAt).getTime()
    if (age < POLL_FAST_THRESHOLD) return POLL_INTERVAL_FAST
    if (age < POLL_NORMAL_THRESHOLD) return POLL_INTERVAL_NORMAL
    return POLL_INTERVAL_SLOW
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const pollOnce = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/ai-content-studio/status/${jobId}`)
      if (!res.ok) return
      const data = await res.json()

      setJob(prev => prev ? {
        ...prev,
        status: data.status,
        progress: data.progress,
        resultType: data.resultType,
        error: data.error || null,
        evaluation: data.evaluation || null,
        evaluationNote: data.evaluationNote || null,
        savedToLibrary: data.savedToLibrary ?? false,
        updatedAt: new Date().toISOString(),
      } : prev)

      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling()
      }
    } catch {
      // Ağ hatalarında sessizce devam et
    }
  }, [])

  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    // İlk poll'u hemen yap
    pollOnce(jobId)
    // Sonra interval ile devam
    pollingRef.current = setInterval(() => {
      pollOnce(jobId)
    }, getInterval())
  }, [pollOnce])

  const startGeneration = useCallback(async (params: StartParams): Promise<string | null> => {
    setError(null)
    setStarting(true)

    try {
      const res = await fetch('/api/admin/ai-content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId: params.notebookId,
          artifactType: params.artifactType,
          title: params.title,
          instructions: params.instructions,
          settings: params.settings,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Üretim başlatılamadı')
      }

      const data = await res.json()
      const jobId: string = data.jobId
      const now = new Date().toISOString()

      const newJob: GenerationJob = {
        id: jobId,
        title: params.title,
        artifactType: params.artifactType,
        status: data.status || 'queued',
        progress: 0,
        resultType: null,
        error: null,
        instructions: params.instructions || null,
        settings: params.settings || {},
        evaluation: null,
        evaluationNote: null,
        evaluatedAt: null,
        savedToLibrary: false,
        contentLibraryId: null,
        savedAt: null,
        contentData: null,
        createdAt: now,
        updatedAt: now,
      }

      setJob(newJob)

      // Global store'a da ekle (poller ve sidebar badge için)
      addStoreJob({
        id: jobId,
        title: params.title,
        artifactType: params.artifactType,
        status: newJob.status as 'queued' | 'processing' | 'downloading' | 'completed' | 'failed',
        progress: 0,
        createdAt: now,
      })

      startPolling(jobId)
      return jobId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
      return null
    } finally {
      setStarting(false)
    }
  }, [addStoreJob, startPolling])

  const loadJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/ai-content-studio/status/${jobId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'İçerik bulunamadı')
      }

      const data = await res.json()
      const loaded: GenerationJob = {
        id: data.jobId,
        title: data.title,
        artifactType: data.artifactType,
        status: data.status,
        progress: data.progress,
        resultType: data.resultType || null,
        error: data.error || null,
        instructions: null,
        settings: {},
        evaluation: data.evaluation || null,
        evaluationNote: data.evaluationNote || null,
        evaluatedAt: data.evaluatedAt || null,
        savedToLibrary: data.savedToLibrary ?? false,
        contentLibraryId: null,
        savedAt: null,
        contentData: null,
        createdAt: data.createdAt,
        updatedAt: new Date().toISOString(),
      }

      setJob(loaded)

      const isActive = ['queued', 'processing', 'downloading'].includes(data.status)
      if (isActive) {
        startPolling(jobId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    }
  }, [startPolling])

  const resumeJob = useCallback((existingJob: GenerationJob) => {
    setJob(existingJob)
    const isActive = ['queued', 'processing', 'downloading'].includes(existingJob.status)
    if (isActive) {
      startPolling(existingJob.id)
    }
  }, [startPolling])

  const reset = useCallback(() => {
    stopPolling()
    setJob(null)
    setError(null)
  }, [])

  return {
    job,
    starting,
    error,
    startGeneration,
    loadJob,
    resumeJob,
    reset,
    isActive: job?.status === 'queued' || job?.status === 'processing' || job?.status === 'downloading',
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
  }
}
