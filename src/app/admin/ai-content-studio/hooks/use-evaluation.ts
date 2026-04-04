'use client'

import { useState, useCallback, useEffect } from 'react'
import type { EvaluationResult } from '../types'

interface LibraryData {
  title: string
  description?: string
  category: string
  difficulty: string
  targetRoles: string[]
  duration: number
  smgPoints?: number
}

interface UseEvaluationReturn {
  evaluation: EvaluationResult | null
  evaluationNote: string
  setEvaluationNote: (note: string) => void
  saving: boolean
  error: string | null
  savedId: string | null
  evaluate: (result: EvaluationResult, note?: string) => Promise<void>
  approve: (libraryData: LibraryData) => Promise<void>
  discard: () => Promise<void>
  reset: () => void
  isApproved: boolean
  isRejected: boolean
  isSaved: boolean
}

export function useEvaluation(jobId: string | null): UseEvaluationReturn {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [evaluationNote, setEvaluationNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // jobId değişiminde state sıfırla
  useEffect(() => {
    setEvaluation(null)
    setEvaluationNote('')
    setSavedId(null)
    setError(null)
  }, [jobId])

  const evaluate = useCallback(async (result: EvaluationResult, note?: string) => {
    if (!jobId) return
    setError(null)

    try {
      const res = await fetch(`/api/admin/ai-content-studio/evaluate/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation: result, note }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Değerlendirme başarısız')
      }

      setEvaluation(result)
      if (note) setEvaluationNote(note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
    }
  }, [jobId])

  const approve = useCallback(async (libraryData: LibraryData) => {
    if (!jobId) return
    setError(null)
    setSaving(true)

    try {
      const res = await fetch(`/api/admin/ai-content-studio/approve/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(libraryData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Kütüphaneye kaydetme başarısız')
      }

      const data = await res.json()
      setSavedId(data.contentLibraryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }, [jobId])

  const discard = useCallback(async () => {
    if (!jobId) return
    setError(null)

    try {
      const res = await fetch(`/api/admin/ai-content-studio/discard/${jobId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Silme başarısız')
      }

      setEvaluation(null)
      setEvaluationNote('')
      setSavedId(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
    }
  }, [jobId])

  const reset = useCallback(() => {
    setEvaluation(null)
    setEvaluationNote('')
    setSavedId(null)
    setError(null)
  }, [])

  return {
    evaluation,
    evaluationNote,
    setEvaluationNote,
    saving,
    error,
    savedId,
    evaluate,
    approve,
    discard,
    reset,
    isApproved: evaluation === 'approved',
    isRejected: evaluation === 'rejected',
    isSaved: savedId !== null,
  }
}
