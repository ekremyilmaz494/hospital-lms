'use client'

import { Loader2, CheckCircle, XCircle, RefreshCw, ArrowLeft, Clock, Sparkles } from 'lucide-react'
import type { GenerationJob } from '../types'
import { getFormatConfig } from '../lib/format-config'

interface GenerationProgressProps {
  job: GenerationJob | null
  starting: boolean
  error: string | null
  onReset: () => void
}

const STAGES = ['Sırada', 'İşleniyor', 'Üretiliyor', 'İndiriliyor', 'Tamamlandı'] as const

function getStageIndex(status: string, progress: number): number {
  switch (status) {
    case 'queued': return 0
    case 'processing': return progress < 50 ? 1 : 2
    case 'downloading': return 3
    case 'completed': return 4
    default: return 0
  }
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Sırada bekliyor...',
  processing: 'İçerik üretiliyor...',
  downloading: 'Dosya indiriliyor...',
}

export function GenerationProgress({ job, starting, error, onReset }: GenerationProgressProps) {
  // Starting
  if (starting && !job) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Üretim başlatılıyor...
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          NotebookLM&apos;e bağlanılıyor
        </p>
      </div>
    )
  }

  // Error (no job)
  if (error && !job) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)' }}
      >
        <XCircle className="mx-auto h-10 w-10" style={{ color: 'var(--color-error)' }} />
        <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Üretim Başarısız
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Geri Dön
        </button>
      </div>
    )
  }

  if (!job) return null

  // Failed
  if (job.status === 'failed') {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)' }}
      >
        <XCircle className="mx-auto h-10 w-10" style={{ color: 'var(--color-error)' }} />
        <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Üretim Başarısız
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>{job.error || error || 'Bilinmeyen hata'}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Geri Dön
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            <RefreshCw className="h-4 w-4" />
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  // Completed
  if (job.status === 'completed') {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-8 text-center"
        style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)' }}
      >
        {/* Sparkle dots */}
        <div className="pointer-events-none absolute inset-0">
          {[...Array(4)].map((_, i) => (
            <span
              key={i}
              className="absolute h-1 w-1 rounded-full"
              style={{
                background: 'var(--color-success)',
                top: `${20 + i * 15}%`,
                left: `${10 + i * 25}%`,
                opacity: 0,
                animation: `sparkle 2s ease-in-out ${i * 0.4}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0); }
            50% { opacity: 0.8; transform: scale(1.5); }
          }
        `}</style>

        <CheckCircle className="mx-auto h-10 w-10" style={{ color: 'var(--color-success)' }} />
        <h3 className="mt-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
          İçerik Hazır!
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          İçeriğiniz başarıyla üretildi. Aşağıda önizleyebilir ve değerlendirebilirsiniz.
        </p>
      </div>
    )
  }

  // Active: queued / processing / downloading
  const stageIdx = getStageIndex(job.status, job.progress)
  const config = getFormatConfig(job.artifactType)

  return (
    <div className="space-y-6 py-4">
      {/* Stage Indicator */}
      <div className="flex items-center justify-between px-2">
        {STAGES.map((label, i) => {
          const isPast = i < stageIdx
          const isActive = i === stageIdx
          const dotColor = isPast ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-border)'

          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <span
                  className="rounded-full"
                  style={{
                    width: isActive ? 16 : 12,
                    height: isActive ? 16 : 12,
                    background: isPast || isActive ? dotColor : 'transparent',
                    border: `2px solid ${dotColor}`,
                    animation: isActive ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <span
                  className="mt-1.5 text-[10px] font-medium"
                  style={{ color: isPast ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                >
                  {label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className="mx-1 h-0.5 flex-1"
                  style={{ background: i < stageIdx ? 'var(--color-success)' : 'var(--color-border)' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Progress Bar */}
      <div>
        <div className="mb-1 text-right">
          <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
            {job.progress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-hover)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${job.progress}%`,
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))',
              transition: 'width 500ms ease',
            }}
          />
        </div>
      </div>

      {/* Status Text + Estimated Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {STATUS_LABELS[job.status] || 'Devam ediyor...'}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Clock className="h-3.5 w-3.5" />
          Tahmini süre: ~{config.estimatedMinutes} dakika
        </span>
      </div>
    </div>
  )
}
