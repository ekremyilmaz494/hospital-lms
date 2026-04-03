'use client'

import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import type { GenerationJob } from '../types'
import { getFormatConfig } from '../lib/format-config'

interface Props {
  job: GenerationJob | null
  starting: boolean
  error: string | null
  onReset: () => void
}

const STAGES = [
  { label: 'Notebook oluşturuluyor', minProgress: 0 },
  { label: 'Belge kaynağı ekleniyor', minProgress: 25 },
  { label: 'İçerik üretiliyor', minProgress: 50 },
  { label: 'Dosya hazırlanıyor', minProgress: 75 },
  { label: 'Tamamlandı', minProgress: 100 },
]

function getCurrentStageIndex(progress: number): number {
  let idx = 0
  for (let i = 0; i < STAGES.length; i++) {
    if (progress >= STAGES[i].minProgress) idx = i
  }
  return idx
}

export function GenerationProgress({ job, starting, error, onReset }: Props) {
  if (starting && !job) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Üretim başlatılıyor...
        </p>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <XCircle className="h-10 w-10" style={{ color: 'var(--color-error)' }} />
        <p className="text-[13px] font-semibold">{error}</p>
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all"
          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </button>
      </div>
    )
  }

  if (!job) return null

  const { progress, error: jobError, format } = job
  const status = job.status as string
  const formatCfg = getFormatConfig(format)
  const stageIdx = status === 'completed' ? STAGES.length - 1 : getCurrentStageIndex(progress)

  return (
    <div className="space-y-6">
      {/* Format etiketi */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{formatCfg.icon}</span>
        <div>
          <p className="text-[13px] font-bold">{formatCfg.label} üretiliyor</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {formatCfg.estimatedMinutes} sürebilir
          </p>
        </div>
      </div>

      {/* İlerleme çubuğu */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold">{STAGES[stageIdx].label}</span>
          <span className="text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>
            {status === 'completed' ? 100 : status === 'failed' ? 0 : progress}%
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--color-border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${status === 'completed' ? 100 : status === 'failed' ? progress : progress}%`,
              background: status === 'failed'
                ? 'var(--color-error)'
                : 'linear-gradient(90deg, var(--color-primary), #34d399)',
            }}
          />
        </div>
      </div>

      {/* Aşama göstergesi */}
      <div className="flex items-start gap-0">
        {STAGES.map((stage, i) => {
          const done = i < stageIdx || status === 'completed'
          const active = i === stageIdx && status !== 'completed' && status !== 'failed'
          const failed = status === 'failed' && i === stageIdx

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              {/* Bağlantı çizgisi + nokta */}
              <div className="flex w-full items-center">
                <div
                  className="h-0.5 flex-1"
                  style={{
                    background: i === 0 ? 'transparent' : done ? 'var(--color-primary)' : 'var(--color-border)',
                  }}
                />
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    background: failed ? 'var(--color-error)'
                      : done || status === 'completed' ? 'var(--color-primary)'
                      : active ? 'var(--color-primary-light)'
                      : 'var(--color-border)',
                    border: active ? '2px solid var(--color-primary)' : 'none',
                  }}
                >
                  {active && (
                    <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--color-primary)' }} />
                  )}
                  {done && !active && !failed && (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                  {failed && <XCircle className="h-4 w-4 text-white" />}
                </div>
                <div
                  className="h-0.5 flex-1"
                  style={{
                    background: i === STAGES.length - 1 ? 'transparent' : done ? 'var(--color-primary)' : 'var(--color-border)',
                  }}
                />
              </div>
              {/* Etiket */}
              <p
                className="text-center text-[9px] leading-tight"
                style={{
                  color: done || active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {stage.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Durum mesajı */}
      {status === 'completed' && (
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ background: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)' }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--color-success)' }} />
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--color-success)' }}>İçerik başarıyla üretildi!</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Önizlemeye geçmek için aşağıdaki butona tıklayın.
            </p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ background: 'var(--color-error-bg)', borderLeft: '4px solid var(--color-error)' }}
        >
          <XCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-error)' }} />
          <div className="flex-1">
            <p className="text-[13px] font-bold" style={{ color: 'var(--color-error)' }}>Üretim başarısız</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {jobError ?? 'Beklenmeyen bir hata oluştu.'}
            </p>
          </div>
          <button
            onClick={onReset}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{ background: 'var(--color-error)', color: '#fff' }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tekrar Dene
          </button>
        </div>
      )}

      {(status === 'queued' || status === 'processing') && (
        <p className="text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Sayfa kapatılsa da üretim arka planda devam eder.
        </p>
      )}
    </div>
  )
}
