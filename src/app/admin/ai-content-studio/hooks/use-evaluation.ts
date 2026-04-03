'use client'

// AI İçerik Stüdyosu — Değerlendirme hook'u
// Beğen → Kütüphaneye Ekle veya Beğenme → Sil / Tekrar Üret akışı

import { useState, useCallback } from 'react'
import type { EvaluationResult } from '../types'

export function useEvaluation(jobId: string | null) {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [evaluationNote, setEvaluationNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Değerlendirme kaydet (approved / rejected)
  const evaluate = useCallback(async (result: EvaluationResult, note?: string) => {
    if (!jobId) return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/ai-content-studio/evaluate/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation: result, note: note ?? (evaluationNote || undefined) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Değerlendirme başarısız.')
      }
      setEvaluation(result)
      if (note) setEvaluationNote(note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setSaving(false)
    }
  }, [jobId, evaluationNote])

  // Kütüphaneye ekle (sadece evaluation === "approved" ise çalışır)
  const approve = useCallback(async (params: {
    title: string
    description?: string
    category: string
    difficulty: string
    targetRoles: string[]
    duration?: number
  }) => {
    if (!jobId || evaluation !== 'approved') return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/ai-content-studio/approve/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Kaydetme başarısız.')
      }
      const { contentLibraryId } = await res.json()
      setSavedId(contentLibraryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.')
    } finally {
      setSaving(false)
    }
  }, [jobId, evaluation])

  // Sil
  const discard = useCallback(async () => {
    if (!jobId) return
    await fetch(`/api/admin/ai-content-studio/discard/${jobId}`, { method: 'DELETE' })
  }, [jobId])

  // State sıfırla (tekrar üretim için)
  const reset = useCallback(() => {
    setEvaluation(null)
    setEvaluationNote('')
    setSaving(false)
    setError(null)
    setSavedId(null)
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
  }
}
