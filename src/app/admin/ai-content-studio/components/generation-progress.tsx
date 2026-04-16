'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, RefreshCw, ArrowLeft, Clock, Sparkles, Zap, Download, Cpu } from 'lucide-react'
import type { GenerationJob } from '../types'
import { getFormatConfig } from '../lib/format-config'

interface GenerationProgressProps {
  job: GenerationJob | null
  starting: boolean
  error: string | null
  onReset: () => void
}

const STAGES = [
  { key: 'queued', label: 'Sırada', icon: Clock, description: 'Üretim kuyruğunda bekleniyor' },
  { key: 'processing', label: 'İşleniyor', icon: Cpu, description: 'NotebookLM içerik oluşturuyor' },
  { key: 'generating', label: 'Üretiliyor', icon: Sparkles, description: 'AI içerik şekillendiriyor' },
  { key: 'downloading', label: 'İndiriliyor', icon: Download, description: 'Dosya aktarılıyor' },
  { key: 'completed', label: 'Tamamlandı', icon: CheckCircle, description: 'İçerik hazır' },
] as const

function getStageIndex(status: string, progress: number): number {
  switch (status) {
    case 'queued': return 0
    case 'processing': return progress < 50 ? 1 : 2
    case 'downloading': return 3
    case 'completed': return 4
    default: return 0
  }
}

const STATUS_MESSAGES: Record<string, string[]> = {
  queued: ['Üretim kuyruğuna alındı...', 'Kaynaklar hazırlanıyor...'],
  processing: ['NotebookLM çalışıyor...', 'İçerik analiz ediliyor...', 'Yapay zeka üretiyor...', 'Veriler işleniyor...'],
  downloading: ['Dosya indiriliyor...', 'İçerik aktarılıyor...', 'Neredeyse bitti...'],
}

function useRotatingMessage(status: string) {
  const [index, setIndex] = useState(0)
  const messages = STATUS_MESSAGES[status] ?? ['Devam ediyor...']

  useEffect(() => {
    setIndex(0)
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [status, messages.length])

  return messages[index]
}

function useElapsedTime(startTime: string | undefined) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const start = new Date(startTime).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/* ─── Orbital Ring ─── */
function OrbitalRing({ progress, isActive }: { progress: number; isActive: boolean }) {
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      {/* Glow backdrop */}
      {isActive && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 120, height: 120,
            background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-600) calc(0.15 * 100%), transparent) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <svg width="140" height="140" className="absolute -rotate-90">
        {/* Track */}
        <circle cx="70" cy="70" r="54" fill="none" stroke="var(--color-border)" strokeWidth="4" opacity="0.4" />
        {/* Progress arc */}
        <motion.circle
          cx="70" cy="70" r="54"
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Glow on tip */}
        <motion.circle
          cx="70" cy="70" r="54"
          fill="none"
          stroke="color-mix(in srgb, var(--brand-600) calc(0.4 * 100%), transparent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: 'blur(6px)' }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--brand-600)" />
            <stop offset="50%" stopColor="var(--brand-500)" />
            <stop offset="100%" stopColor="var(--brand-400)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.span
          key={progress}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl font-black tabular-nums"
          style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-primary)', letterSpacing: '-0.02em' }}
        >
          {progress}
        </motion.span>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          yüzde
        </span>
      </div>
    </div>
  )
}

/* ─── Floating Particles ─── */
function FloatingParticles({ count = 6, active = true }: { count?: number; active?: boolean }) {
  if (!active) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + (i % 3) * 2,
            height: 3 + (i % 3) * 2,
            background: i % 2 === 0 ? 'var(--color-primary)' : 'var(--color-success)',
          }}
          initial={{
            x: `${15 + (i * 14) % 70}%`,
            y: '110%',
            opacity: 0,
          }}
          animate={{
            y: [110, -10],
            opacity: [0, 0.6, 0.6, 0],
            x: `${15 + (i * 14) % 70 + Math.sin(i) * 8}%`,
          }}
          transition={{
            duration: 6 + i * 0.8,
            repeat: Infinity,
            delay: i * 1.2,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  )
}

/* ─── Stage Timeline ─── */
function StageTimeline({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {STAGES.map((stage, i) => {
        const isPast = i < currentStage
        const isActive = i === currentStage
        const isFuture = i > currentStage
        const Icon = stage.icon

        return (
          <div key={stage.key} className="flex items-center flex-1">
            <motion.div
              className="flex flex-col items-center relative"
              initial={false}
              animate={{ scale: isActive ? 1 : 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Active glow ring */}
              {isActive && (
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: 40, height: 40, top: -4, left: '50%', marginLeft: -20,
                    border: '2px solid var(--color-primary)',
                    opacity: 0.3,
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              {/* Icon circle */}
              <motion.div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 32, height: 32,
                  background: isPast
                    ? 'var(--color-success)'
                    : isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-surface-hover)',
                  boxShadow: isActive ? '0 0 20px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)' : 'none',
                }}
                layout
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{
                    color: isPast || isActive ? 'white' : 'var(--color-text-muted)',
                  }}
                />
              </motion.div>

              {/* Label */}
              <motion.span
                className="mt-2 text-[10px] font-semibold tracking-wide text-center whitespace-nowrap"
                style={{
                  color: isPast
                    ? 'var(--color-success)'
                    : isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-text-muted)',
                }}
                animate={{ opacity: isFuture ? 0.5 : 1 }}
              >
                {stage.label}
              </motion.span>
            </motion.div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div className="flex-1 mx-1.5 h-[2px] relative overflow-hidden rounded-full" style={{ background: 'var(--color-border)', opacity: 0.5 }}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: isPast
                      ? 'var(--color-success)'
                      : isActive
                        ? 'linear-gradient(90deg, var(--color-primary), transparent)'
                        : 'transparent',
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: isPast ? '100%' : isActive ? '60%' : '0%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                {/* Shimmer on active connector */}
                {isActive && (
                  <motion.div
                    className="absolute inset-y-0 w-8 rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand-600) calc(0.5 * 100%), transparent), transparent)' }}
                    animate={{ x: ['-100%', '400%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Shimmer Bar ─── */
function ShimmerProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full">
      <div
        className="h-[6px] w-full overflow-hidden rounded-full"
        style={{ background: 'var(--color-surface-hover)' }}
      >
        <motion.div
          className="relative h-full rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, var(--brand-600), var(--brand-500), var(--brand-400))',
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              width: '40%',
            }}
            animate={{ x: ['-100%', '350%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </div>
    </div>
  )
}

/* ─── Completion Celebration ─── */
function CompletionCelebration() {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl p-10 text-center"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 6%, var(--color-surface)) 0%, color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)) 100%)',
        border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Background celebration particles */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 4 + (i % 4) * 2,
            height: 4 + (i % 4) * 2,
            background: i % 3 === 0 ? 'var(--brand-600)' : i % 3 === 1 ? 'var(--brand-500)' : '#f59e0b',
          }}
          initial={{
            x: '50%', y: '50%',
            scale: 0, opacity: 0,
          }}
          animate={{
            x: `${10 + (i * 7.5) % 80}%`,
            y: `${10 + ((i * 13) % 80)}%`,
            scale: [0, 1.5, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 2,
            delay: 0.1 + i * 0.08,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Success icon with ring */}
      <motion.div
        className="relative mx-auto mb-5"
        style={{ width: 72, height: 72 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid var(--color-success)', opacity: 0.3 }}
          animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <div
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{
            background: 'linear-gradient(135deg, var(--brand-600), var(--brand-500))',
            boxShadow: '0 8px 32px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)',
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.4 }}
          >
            <CheckCircle className="h-8 w-8 text-white" />
          </motion.div>
        </div>
      </motion.div>

      <motion.h3
        className="text-xl font-extrabold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        İçerik Hazır!
      </motion.h3>
      <motion.p
        className="mt-2 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        İçeriğiniz başarıyla üretildi. Aşağıda önizleyebilir ve değerlendirebilirsiniz.
      </motion.p>
    </motion.div>
  )
}

/* ─── Failure State ─── */
function FailureState({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <motion.div
      className="rounded-2xl p-8 text-center"
      style={{
        background: 'color-mix(in srgb, var(--color-error) 6%, var(--color-surface))',
        border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
      }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <XCircle className="mx-auto h-12 w-12" style={{ color: 'var(--color-error)', opacity: 0.8 }} />
      </motion.div>
      <h3 className="mt-4 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
        Üretim Başarısız
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-80"
          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Geri Dön
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
            boxShadow: '0 4px 16px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Tekrar Dene
        </button>
      </div>
    </motion.div>
  )
}

/* ─── Main Export ─── */
export function GenerationProgress({ job, starting, error, onReset }: GenerationProgressProps) {
  const rotatingMessage = useRotatingMessage(job?.status ?? 'queued')
  const elapsedTime = useElapsedTime(job?.createdAt)
  const config = job ? getFormatConfig(job.artifactType) : null

  // Starting state
  if (starting && !job) {
    return (
      <motion.div
        className="flex flex-col items-center gap-5 py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="h-10 w-10" style={{ color: 'var(--color-primary)' }} />
        </motion.div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
            Üretim başlatılıyor...
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            NotebookLM&apos;e bağlanılıyor
          </p>
        </div>
        <ShimmerProgressBar progress={15} />
      </motion.div>
    )
  }

  // Error without job
  if (error && !job) {
    return <FailureState message={error} onReset={onReset} />
  }

  if (!job) return null

  // Failed
  if (job.status === 'failed') {
    return <FailureState message={job.error || error || 'Bilinmeyen hata'} onReset={onReset} />
  }

  // Completed
  if (job.status === 'completed') {
    return <CompletionCelebration />
  }

  // Active generation
  const stageIdx = getStageIndex(job.status, job.progress)
  const currentStage = STAGES[stageIdx]

  return (
    <motion.div
      className="relative space-y-8 py-6 px-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <FloatingParticles active />

      {/* Top section: Orbital + Info */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        <OrbitalRing progress={job.progress} isActive />

        <div className="flex flex-col items-center sm:items-start gap-3">
          {/* Format badge */}
          {config && (
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))',
                color: 'var(--color-primary)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
              }}
            >
              <span>{config.icon}</span>
              {config.label}
            </div>
          )}

          {/* Rotating status message */}
          <AnimatePresence mode="wait">
            <motion.p
              key={rotatingMessage}
              className="text-base font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              {rotatingMessage}
            </motion.p>
          </AnimatePresence>

          {/* Stage description */}
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {currentStage?.description}
          </p>

          {/* Timer + estimated */}
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1.5 tabular-nums" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
              <Clock className="h-3 w-3" />
              {elapsedTime}
            </span>
            {config && (
              <span className="opacity-60">
                Tahmini ~{config.estimatedMinutes} dk
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Shimmer progress bar */}
      <ShimmerProgressBar progress={job.progress} />

      {/* Stage timeline */}
      <StageTimeline currentStage={stageIdx} />
    </motion.div>
  )
}
