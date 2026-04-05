'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, Check, AlertCircle, BookOpen, ArrowUpRight } from 'lucide-react'
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
  index?: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  pending: { label: 'Bekliyor', color: 'var(--color-text-muted)', pulse: false },
  queued: { label: 'Sırada', color: 'var(--color-warning)', pulse: false },
  processing: { label: 'Üretiliyor', color: 'var(--color-warning)', pulse: true },
  downloading: { label: 'İndiriliyor', color: 'var(--color-primary)', pulse: true },
  completed: { label: 'Tamamlandı', color: 'var(--color-success)', pulse: false },
  failed: { label: 'Başarısız', color: 'var(--color-error)', pulse: false },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Az önce'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  const days = Math.floor(hours / 24)
  return `${days} gün önce`
}

export function ContentCard({
  id, title, artifactType, status, progress, evaluation, savedToLibrary, error, createdAt, index = 0,
}: ContentCardProps) {
  const config = getFormatConfig(artifactType)
  const storeJob = useAiGenerationStore(s => s.activeJobs[id])
  const liveProgress = storeJob?.progress ?? progress
  const liveStatus = storeJob?.status ?? status
  const statusCfg = STATUS_CONFIG[liveStatus] || STATUS_CONFIG.pending
  const isActive = liveStatus === 'queued' || liveStatus === 'processing' || liveStatus === 'downloading'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
    >
      <Link
        href={`/admin/ai-content-studio/${id}`}
        className="group relative block overflow-hidden rounded-2xl transition-all duration-300"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.08)'
          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-primary) 30%, var(--color-border))'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
          e.currentTarget.style.borderColor = 'var(--color-border)'
        }}
      >
        {/* Active shimmer overlay */}
        {isActive && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ opacity: 0.5 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${statusCfg.color} 8%, transparent), transparent)`,
                animation: 'shimmerSweep 3s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Top accent line */}
        <div
          className="h-[2px] w-full"
          style={{
            background: isActive
              ? `linear-gradient(90deg, ${statusCfg.color}, transparent)`
              : liveStatus === 'completed'
                ? 'linear-gradient(90deg, var(--color-success), transparent)'
                : 'transparent',
          }}
        />

        <div className="p-5">
          {/* Header: format icon + type + status */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{
                  background: `color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-hover))`,
                }}
              >
                {config.icon}
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {config.label}
                </span>
              </div>
            </div>

            {/* Status badge */}
            {savedToLibrary ? (
              <span
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold"
                style={{ background: 'color-mix(in srgb, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
              >
                <BookOpen className="h-3 w-3" />
                Kütüphanede
              </span>
            ) : (
              <span
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold"
                style={{ background: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`, color: statusCfg.color }}
              >
                {statusCfg.pulse && <Loader2 className="h-3 w-3 animate-spin" />}
                {liveStatus === 'completed' && <Check className="h-3 w-3" />}
                {liveStatus === 'failed' && <AlertCircle className="h-3 w-3" />}
                {statusCfg.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="mt-4 line-clamp-2 text-[14px] font-bold leading-snug" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>

          {/* Progress bar */}
          {isActive && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>İlerleme</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: statusCfg.color, fontFamily: 'var(--font-mono, monospace)' }}>
                  {liveProgress}%
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--color-surface-hover)' }}>
                <div
                  className="relative h-full rounded-full overflow-hidden"
                  style={{
                    width: `${liveProgress}%`,
                    background: `linear-gradient(90deg, ${statusCfg.color}, color-mix(in srgb, ${statusCfg.color} 70%, var(--color-success)))`,
                    transition: 'width 600ms ease',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'shimmerSweep 1.5s linear infinite',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {liveStatus === 'failed' && error && (
            <p className="mt-3 truncate rounded-lg px-3 py-2 text-[11px]" style={{ background: 'color-mix(in srgb, var(--color-error) 6%, transparent)', color: 'var(--color-error)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {formatRelativeTime(createdAt)}
          </span>
          <div className="flex items-center gap-2">
            {evaluation && (
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: `color-mix(in srgb, ${evaluation === 'approved' ? 'var(--color-success)' : 'var(--color-error)'} 12%, transparent)`,
                  color: evaluation === 'approved' ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {evaluation === 'approved' ? 'Onaylandı' : 'Reddedildi'}
              </span>
            )}
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              style={{ color: 'var(--color-text-muted)', opacity: 0 }}
            />
          </div>
        </div>

        <style>{`
          @keyframes shimmerSweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          .group:hover [style*="opacity: 0"]:last-child {
            opacity: 1 !important;
          }
        `}</style>
      </Link>
    </motion.div>
  )
}
