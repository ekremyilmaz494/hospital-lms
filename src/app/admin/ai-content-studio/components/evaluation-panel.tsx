'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, RefreshCw, Trash2, BookOpen, AlertCircle, ExternalLink } from 'lucide-react'
import type { GenerationJob, EvaluationResult } from '../types'

interface EvaluationPanelProps {
  job: GenerationJob
  evaluation: EvaluationResult | null
  evaluationNote: string
  saving: boolean
  savedId: string | null
  error: string | null
  onEvaluate: (result: EvaluationResult, note?: string) => Promise<void>
  onApprove: () => void
  onDiscard: () => Promise<void>
  onRegenerate: () => void
  onNoteChange: (note: string) => void
}

export function EvaluationPanel({
  job, evaluation, evaluationNote, saving, savedId, error,
  onEvaluate, onApprove, onDiscard, onRegenerate, onNoteChange,
}: EvaluationPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Saved to library
  if (savedId) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
        }}
      >
        <BookOpen className="mx-auto h-8 w-8" style={{ color: 'var(--color-success)' }} />
        <h3 className="mt-3 text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          İçerik kütüphaneye eklendi!
        </h3>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/admin/content-library"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Kütüphaneye Git
          </Link>
        </div>
      </div>
    )
  }

  // Error
  const errorBox = error ? (
    <div
      className="mb-4 flex items-start gap-2 rounded-xl p-3 text-sm"
      style={{
        background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-surface))',
        color: 'var(--color-error)',
      }}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {error}
    </div>
  ) : null

  // Not evaluated yet
  if (!evaluation) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {errorBox}
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          İçeriği Değerlendirin
        </h3>
        <textarea
          value={evaluationNote}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Değerlendirme notunuz (opsiyonel)..."
          rows={2}
          className="mt-3 w-full resize-none rounded-xl p-3 text-sm outline-none"
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => onEvaluate('approved', evaluationNote || undefined)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-success)', color: 'white' }}
          >
            <Check className="h-4 w-4" />
            Onayla
          </button>
          <button
            type="button"
            onClick={() => onEvaluate('rejected', evaluationNote || undefined)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ background: 'transparent', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
          >
            <X className="h-4 w-4" />
            Reddet
          </button>
        </div>
      </div>
    )
  }

  // Approved
  if (evaluation === 'approved') {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {errorBox}
        <div
          className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'color-mix(in srgb, var(--color-success) 10%, var(--color-surface))' }}
        >
          <Check className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>İçerik onaylandı</span>
        </div>
        {evaluationNote && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Not: {evaluationNote}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            <BookOpen className="h-4 w-4" />
            Kütüphaneye Ekle
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tekrar Üret
          </button>
          <DeleteButton confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDiscard={onDiscard} />
        </div>
      </div>
    )
  }

  // Rejected
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {errorBox}
      <div
        className="flex items-center gap-2 rounded-xl p-3"
        style={{ background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-surface))' }}
      >
        <X className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>İçerik reddedildi</span>
      </div>
      {evaluationNote && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>Not: {evaluationNote}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tekrar Üret
        </button>
        <DeleteButton confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDiscard={onDiscard} />
      </div>
    </div>
  )
}

function DeleteButton({
  confirmDelete, setConfirmDelete, onDiscard,
}: {
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onDiscard: () => Promise<void>
}) {
  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 rounded-xl p-2" style={{ background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Emin misiniz?</span>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          İptal
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{ background: 'var(--color-error)', color: 'white' }}
        >
          Sil
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setConfirmDelete(true)}
      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
      style={{ color: 'var(--color-error)' }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Sil
    </button>
  )
}
