'use client'

import Link from 'next/link'
import { Loader2, Check, AlertCircle, BookOpen } from 'lucide-react'
import { getFormatConfig } from '../lib/format-config'
import { useAiGenerationStore } from '@/store/ai-generation-store'
import type { GenerationStatus, EvaluationResult } from '../types'

interface ContentCardProps {
  id: string
  title: string
  artifactType: string
  status: GenerationStatus
  progress: number
  evaluation: EvaluationResult | null
  savedToLibrary: boolean
  error: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  pending: { label: 'Bekliyor', color: 'var(--color-text-muted)', pulse: false },
  queued: { label: 'Sırada', color: 'var(--color-warning)', pulse: false },
  processing: { label: 'Üretiliyor...', color: 'var(--color-warning)', pulse: true },
  downloading: { label: 'İndiriliyor...', color: 'var(--color-primary)', pulse: true },
  completed: { label: 'Tamamlandı', color: 'var(--color-success)', pulse: false },
  failed: { label: 'Başarısız', color: 'var(--color-error)', pulse: false },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ContentCard({
  id, title, artifactType, status, progress, evaluation, savedToLibrary, error, createdAt,
}: ContentCardProps) {
  const config = getFormatConfig(artifactType)
  const storeJob = useAiGenerationStore(s => s.activeJobs[id])
  const liveProgress = storeJob?.progress ?? progress
  const liveStatus = storeJob?.status ?? status
  const statusCfg = STATUS_CONFIG[liveStatus] || STATUS_CONFIG.pending
  const isActive = liveStatus === 'queued' || liveStatus === 'processing' || liveStatus === 'downloading'

  return (
    <Link
      href={`/admin/ai-content-studio/${id}`}
      className="block rounded-2xl transition-all duration-200"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <div className="p-4">
        {/* Header: format + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {config.label}
            </span>
          </div>
          {savedToLibrary ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' }}
            >
              <BookOpen className="h-3 w-3" />
              Kütüphanede
            </span>
          ) : (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: `color-mix(in srgb, ${statusCfg.color} 15%, transparent)`, color: statusCfg.color }}
            >
              {statusCfg.pulse && <Loader2 className="h-3 w-3 animate-spin" />}
              {liveStatus === 'completed' && <Check className="h-3 w-3" />}
              {liveStatus === 'failed' && <AlertCircle className="h-3 w-3" />}
              {statusCfg.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="mt-3 line-clamp-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>

        {/* Progress bar */}
        {isActive && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <span>İlerleme</span>
              <span className="font-semibold">{liveProgress}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-hover)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${liveProgress}%`,
                  background: 'linear-gradient(90deg, var(--color-primary), var(--color-success))',
                  transition: 'width 500ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {liveStatus === 'failed' && error && (
          <p className="mt-2 truncate text-xs" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {formatDate(createdAt)}
        </span>
        {evaluation && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: `color-mix(in srgb, ${evaluation === 'approved' ? 'var(--color-success)' : 'var(--color-error)'} 15%, transparent)`,
              color: evaluation === 'approved' ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            {evaluation === 'approved' ? 'Onaylandı' : 'Reddedildi'}
          </span>
        )}
      </div>
    </Link>
  )
}
