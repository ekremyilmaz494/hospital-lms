'use client'

// AI İçerik Stüdyosu — Detay/Önizleme Sayfası
// Tek bir üretimin detayı: progress, önizleme, değerlendirme, kütüphane kayıt

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { useAiGenerationStore } from '@/store/ai-generation-store'

import { useGeneration } from '../hooks/use-generation'
import { useEvaluation } from '../hooks/use-evaluation'

import { GenerationProgress } from '../components/generation-progress'
import { ContentPreview } from '../components/content-preview'
import { EvaluationPanel } from '../components/evaluation-panel'
import { SaveToLibraryModal } from '../components/save-to-library-modal'
import { getFormatConfig } from '../lib/format-config'

export default function AIContentStudioDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  // ── Hooks ──
  const {
    job,
    starting,
    error: genError,
    loadJob,
    reset: resetGeneration,
    isActive,
    isCompleted,
    isFailed,
  } = useGeneration()

  const evalHook = useEvaluation(jobId)
  const markAsViewed = useAiGenerationStore((s) => s.markAsViewed)

  // ── State ──
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── Derived ──
  const formatConfig = job ? getFormatConfig(job.artifactType) : null
  const resultUrl = job?.status === 'completed' && job.id
    ? `/api/admin/ai-content-studio/result/${job.id}`
    : ''

  // ── Mount: Job yükle + bildirim temizle ──
  useEffect(() => {
    if (!jobId) return

    markAsViewed(jobId)

    const load = async () => {
      try {
        setPageLoading(true)
        setLoadError(null)
        await loadJob(jobId)
      } catch {
        setLoadError('İçerik yüklenirken bir hata oluştu')
      } finally {
        setPageLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // ── Job yüklendiğinde pageLoading kaldır ──
  useEffect(() => {
    if (job) setPageLoading(false)
  }, [job])

  // ── Evaluation approved → save modal aç ──
  useEffect(() => {
    if (evalHook.isApproved && !evalHook.isSaved) {
      setShowSaveModal(true)
    }
  }, [evalHook.isApproved, evalHook.isSaved])

  // ── Handlers ──
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await evalHook.discard()
      router.push('/admin/ai-content-studio')
    } catch {
      setDeleting(false)
    }
  }

  const handleRegenerate = () => {
    router.push('/admin/ai-content-studio/new')
  }

  const handleSaveToLibrary = async (data: {
    title: string
    description?: string
    category: string
    difficulty: string
    targetRoles: string[]
    duration: number
    smgPoints: number
  }) => {
    await evalHook.approve(data)
    setShowSaveModal(false)
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <BlurFade delay={0}>
        <div className="mb-6">
          <Link
            href="/admin/ai-content-studio"
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kütüphane
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {formatConfig && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                  }}
                >
                  <span>{formatConfig.icon}</span>
                </div>
              )}
              <div>
                <h1
                  className="text-xl font-bold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                >
                  {job?.title ?? 'İçerik Detayı'}
                </h1>
                {formatConfig && (
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {formatConfig.icon} {formatConfig.label}
                  </span>
                )}
              </div>
            </div>

            {/* Sil butonu (completed veya failed) */}
            {job && (job.status === 'completed' || job.status === 'failed') && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-opacity duration-200 disabled:opacity-40"
                style={{
                  borderColor: 'var(--color-error)',
                  color: 'var(--color-error)',
                  background: 'transparent',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            )}
          </div>
        </div>
      </BlurFade>

      {/* ── İçerik ── */}
      <BlurFade delay={0.05}>
        {/* Yükleniyor */}
        {pageLoading && !job && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        )}

        {/* Yükleme hatası */}
        {loadError && !job && (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <AlertCircle
              className="mx-auto mb-4 h-12 w-12"
              style={{ color: 'var(--color-error)', opacity: 0.6 }}
            />
            <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--color-error)' }}>
              {loadError}
            </p>
            <Link
              href="/admin/ai-content-studio"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-2"
              style={{ color: 'var(--color-primary)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kütüphaneye Dön
            </Link>
          </div>
        )}

        {/* Aktif Üretim */}
        {job && isActive && (
          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <GenerationProgress
              job={job}
              starting={starting}
              error={genError}
              onReset={() => {
                resetGeneration()
                router.push('/admin/ai-content-studio/new')
              }}
            />
          </div>
        )}

        {/* Başarısız */}
        {job && isFailed && (
          <div
            className="rounded-2xl border p-8 text-center"
            style={{
              background: 'var(--color-error-bg)',
              borderColor: 'color-mix(in srgb, var(--color-error) 30%, transparent)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <AlertCircle
              className="mx-auto mb-4 h-14 w-14"
              style={{ color: 'var(--color-error)', opacity: 0.7 }}
            />
            <h2
              className="text-[18px] font-bold mb-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-error)' }}
            >
              Üretim Başarısız
            </h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {job.error ?? 'İçerik üretimi sırasında bir hata oluştu.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleRegenerate}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Tekrar Dene
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-opacity duration-200 disabled:opacity-40"
                style={{
                  borderColor: 'var(--color-error)',
                  color: 'var(--color-error)',
                  background: 'var(--color-surface)',
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        )}

        {/* Tamamlandı: Preview + Evaluation */}
        {job && isCompleted && resultUrl && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sol: İçerik Önizleme (2 kolon) */}
            <div className="lg:col-span-2">
              <div
                className="rounded-2xl border overflow-hidden"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <ContentPreview job={job} resultUrl={resultUrl} />
              </div>
            </div>

            {/* Sağ: Değerlendirme Paneli (1 kolon) */}
            <div className="lg:col-span-1">
              <div
                className="sticky top-6 rounded-2xl border p-5"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <EvaluationPanel
                  job={job}
                  evaluation={evalHook.evaluation}
                  evaluationNote={evalHook.evaluationNote}
                  saving={evalHook.saving}
                  savedId={evalHook.savedId}
                  error={evalHook.error}
                  onEvaluate={evalHook.evaluate}
                  onApprove={() => setShowSaveModal(true)}
                  onDiscard={handleDelete}
                  onRegenerate={handleRegenerate}
                  onNoteChange={evalHook.setEvaluationNote}
                />
              </div>
            </div>
          </div>
        )}
      </BlurFade>

      {/* ── Kütüphaneye Kaydetme Modalı ── */}
      {job && (
        <SaveToLibraryModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveToLibrary}
          saving={evalHook.saving}
          defaultTitle={job.title}
          artifactType={job.artifactType}
        />
      )}
    </div>
  )
}
