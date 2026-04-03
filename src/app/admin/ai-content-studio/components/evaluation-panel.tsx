'use client'

// AI İçerik Stüdyosu — Değerlendirme paneli
// Akış: Önizleme → Beğen/Beğenme → (Beğendiyse) Kütüphaneye Ekle
// KRİTİK: evaluation !== "approved" → "Kütüphaneye Ekle" DEVRE DIŞI

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, BookPlus, Trash2, RefreshCw, MessageSquare, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { GenerationJob, EvaluationResult } from '../types'
import { SaveToLibraryModal } from './save-to-library-modal'

interface Props {
  job: GenerationJob
  evaluation: EvaluationResult | null
  evaluationNote: string
  saving: boolean
  savedId: string | null
  error: string | null
  onEvaluate: (result: EvaluationResult, note?: string) => void
  onApprove: (params: {
    title: string
    description?: string
    category: string
    difficulty: string
    targetRoles: string[]
    duration?: number
  }) => void
  onDiscard: () => void
  onRegenerate: () => void
  onNoteChange: (note: string) => void
}

export function EvaluationPanel({
  job,
  evaluation,
  evaluationNote,
  saving,
  savedId,
  error,
  onEvaluate,
  onApprove,
  onDiscard,
  onRegenerate,
  onNoteChange,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)

  // ── Zaten kütüphaneye eklendi ──
  if (savedId) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border p-8 text-center"
        style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success)' }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'var(--color-success)' }}
        >
          <CheckCircle2 className="h-8 w-8 text-white" />
        </div>
        <div>
          <p className="text-[16px] font-bold" style={{ color: 'var(--color-success)' }}>
            İçerik kütüphaneye eklendi!
          </p>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            Personel bu içeriği artık eğitim kütüphanesinde görebilir.
          </p>
        </div>
        <a
          href="/admin/content-library"
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
          style={{ background: 'var(--color-success)', boxShadow: 'var(--shadow-sm)' }}
        >
          <ExternalLink className="h-4 w-4" />
          İçerik Kütüphanesine Git
        </a>
      </div>
    )
  }

  return (
    <>
      <div
        className="rounded-2xl border p-5 space-y-5"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Başlık */}
        <div>
          <p className="text-[14px] font-bold">İçeriği Değerlendirin</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {!evaluation
              ? 'Önce içeriği beğenip beğenmediğinizi belirtin.'
              : evaluation === 'approved'
              ? 'İçeriği beğendiniz. Artık kütüphaneye ekleyebilirsiniz.'
              : 'İçeriği beğenmediniz. Silip tekrar üretebilirsiniz.'}
          </p>
        </div>

        {/* Hata mesajı */}
        {error && (
          <div
            className="flex items-center gap-2 rounded-xl p-3 text-[12px]"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── ADIM 1: Değerlendirme (henüz değerlendirilmedi) ── */}
        {!evaluation && (
          <div className="space-y-4">
            {/* Beğen / Beğenme butonları */}
            <div className="flex gap-3">
              <button
                onClick={() => onEvaluate('approved', evaluationNote || undefined)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--color-success), #047857)', boxShadow: 'var(--shadow-sm)' }}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ThumbsUp className="h-5 w-5" />}
                Beğendim
              </button>
              <button
                onClick={() => onEvaluate('rejected', evaluationNote || undefined)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-[14px] font-bold transition-all disabled:opacity-50"
                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ThumbsDown className="h-5 w-5" />}
                Beğenmedim
              </button>
            </div>

            {/* Not ekle (opsiyonel) */}
            <button
              onClick={() => setShowNote((v) => !v)}
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {showNote ? 'Notu gizle' : 'Değerlendirme notu ekle'}
            </button>

            {showNote && (
              <textarea
                value={evaluationNote}
                onChange={(e) => onNoteChange(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Bu içerik hakkındaki görüşünüz... (opsiyonel)"
                className="w-full resize-none rounded-xl border px-4 py-2.5 text-[12px] outline-none transition-all"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
              />
            )}
          </div>
        )}

        {/* ── ADIM 2A: Beğenildi → Kütüphaneye Ekle ── */}
        {evaluation === 'approved' && (
          <div className="space-y-3">
            {/* Durum badge */}
            <div
              className="flex items-center gap-2 rounded-xl p-3"
              style={{ background: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)' }}
            >
              <ThumbsUp className="h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />
              <p className="text-[12px] font-semibold" style={{ color: 'var(--color-success)' }}>
                İçerik beğenildi
                {evaluationNote && <span className="font-normal"> — &quot;{evaluationNote}&quot;</span>}
              </p>
            </div>

            {/* Aksiyon butonları */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(true)}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)', boxShadow: 'var(--shadow-md)' }}
              >
                <BookPlus className="h-5 w-5" />
                Kütüphaneye Ekle
              </button>
              <button
                onClick={onRegenerate}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition-all disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <RefreshCw className="h-4 w-4" />
                Tekrar Üret
              </button>
            </div>
          </div>
        )}

        {/* ── ADIM 2B: Beğenilmedi → Sil / Tekrar Üret ── */}
        {evaluation === 'rejected' && (
          <div className="space-y-3">
            {/* Durum badge */}
            <div
              className="flex items-center gap-2 rounded-xl p-3"
              style={{ background: 'var(--color-error-bg)', borderLeft: '4px solid var(--color-error)' }}
            >
              <ThumbsDown className="h-4 w-4 shrink-0" style={{ color: 'var(--color-error)' }} />
              <p className="text-[12px] font-semibold" style={{ color: 'var(--color-error)' }}>
                İçerik beğenilmedi
                {evaluationNote && <span className="font-normal"> — &quot;{evaluationNote}&quot;</span>}
              </p>
            </div>

            {/* Kütüphaneye Ekle butonu DEVRE DIŞI */}
            <div
              className="rounded-xl p-3 text-center"
              style={{ background: 'var(--color-bg)', border: '1px dashed var(--color-border)' }}
            >
              <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Kütüphaneye eklemek için önce içeriği &quot;Beğendim&quot; olarak değerlendirin.
              </p>
            </div>

            {/* Aksiyon butonları */}
            <div className="flex gap-3">
              <button
                onClick={onRegenerate}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-all disabled:opacity-50"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                <RefreshCw className="h-4 w-4" />
                Aynı Ayarlarla Tekrar Üret
              </button>

              {!discardConfirm ? (
                <button
                  onClick={() => setDiscardConfirm(true)}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold transition-all disabled:opacity-50"
                  style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                >
                  <Trash2 className="h-4 w-4" />
                  Sil
                </button>
              ) : (
                <div
                  className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center"
                  style={{ borderColor: 'var(--color-error)', background: 'var(--color-error-bg)' }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--color-error)' }}>
                    Kalıcı olarak silinecek.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDiscardConfirm(false)}
                      className="rounded-lg border px-3 py-1 text-[11px] font-medium"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={() => { setDiscardConfirm(false); onDiscard() }}
                      className="rounded-lg px-3 py-1 text-[11px] font-bold text-white"
                      style={{ background: 'var(--color-error)' }}
                    >
                      Evet, Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kütüphaneye Ekleme Modal */}
      <SaveToLibraryModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={(params) => { setShowModal(false); onApprove(params) }}
        saving={saving}
        format={job.format}
        defaultTitle={job.title}
      />
    </>
  )
}
