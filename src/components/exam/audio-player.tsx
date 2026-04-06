'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, CheckCircle } from 'lucide-react'
import { PdfViewer } from '@/components/exam/pdf-viewer'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface AudioPlayerProps {
  src: string
  documentUrl?: string
  title: string
  duration: number
  lastPosition?: number
  onProgress: (seconds: number, position: number) => void
  onComplete: () => void
}

export function AudioPlayer({
  src,
  documentUrl,
  title,
  duration,
  lastPosition,
  onProgress,
  onComplete,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lastAllowedTime = useRef(lastPosition ?? 0)
  const completedRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(duration)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // No-seek enforcement — video player ile aynı mantık
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.currentTime > lastAllowedTime.current + 2) {
      audio.currentTime = lastAllowedTime.current
    } else {
      lastAllowedTime.current = Math.max(lastAllowedTime.current, audio.currentTime)
    }
    setCurrentTime(audio.currentTime)
  }, [])

  const handleSeeking = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.currentTime > lastAllowedTime.current + 2) {
      audio.currentTime = lastAllowedTime.current
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setAudioDuration(audio.duration)
    if (lastPosition && lastPosition > 0) {
      audio.currentTime = lastPosition
      lastAllowedTime.current = lastPosition
    }
  }, [lastPosition])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    if (!completedRef.current) {
      completedRef.current = true
      setIsComplete(true)
      onComplete()
    }
  }, [onComplete])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const val = parseFloat(e.target.value)
    audio.volume = val
    setVolume(val)
    if (val === 0) {
      setIsMuted(true)
      audio.muted = true
    } else if (isMuted) {
      setIsMuted(false)
      audio.muted = false
    }
  }, [isMuted])

  // Heartbeat — 15 saniyede bir onProgress çağır
  useEffect(() => {
    if (!isPlaying) return
    const heartbeat = setInterval(() => {
      const audio = audioRef.current
      if (audio) {
        onProgress(audio.currentTime, lastAllowedTime.current)
      }
    }, 15000)
    return () => clearInterval(heartbeat)
  }, [isPlaying, onProgress])

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  return (
    <div className="flex flex-col h-full">
      {/* Audio Player */}
      <div
        className="shrink-0 rounded-2xl p-5 space-y-4"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {title}
          </h3>
          <span
            className="text-xs font-medium shrink-0 ml-3"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--color-text-muted)',
            }}
          >
            {formatTime(currentTime)} / {formatTime(audioDuration)}
          </span>
        </div>

        {/* İlerleme çubuğu — sadece görsel, tıklanamaz */}
        <div className="relative group">
          <div
            className="h-2 w-full rounded-full overflow-hidden cursor-not-allowed"
            style={{ background: 'var(--color-border)' }}
            title="İleri sarma devre dışı"
          >
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${progressPercent}%`,
                background: isComplete ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            />
          </div>
          {/* Tooltip */}
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
            style={{
              background: 'var(--color-text-primary)',
              color: 'var(--color-surface)',
            }}
          >
            İleri sarma devre dışı
          </div>
        </div>

        {/* Kontroller */}
        <div className="flex items-center justify-between">
          {/* Oynat / Duraklat */}
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
            style={{
              background: 'var(--color-primary)',
              color: 'white',
            }}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            )}
          </button>

          {/* Ses seviyesi */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
              style={{ background: 'var(--color-border)' }}
            />
          </div>
        </div>

        {/* Gizli audio element */}
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onSeeking={handleSeeking}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Dinleme Tamamlandı banner */}
      {isComplete && (
        <div
          className="flex items-center justify-center gap-2 py-3 mt-3 rounded-xl text-sm font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
            color: 'var(--color-success)',
          }}
        >
          <CheckCircle className="h-4 w-4" />
          Dinleme Tamamlandı
        </div>
      )}

      {/* PDF Viewer — documentUrl varsa */}
      {documentUrl && (
        <div
          className="flex-1 mt-4 rounded-2xl overflow-hidden min-h-[400px]"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <PdfViewer url={documentUrl} />
        </div>
      )}
    </div>
  )
}
