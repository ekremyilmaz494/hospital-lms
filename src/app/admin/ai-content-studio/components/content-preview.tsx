'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  ZoomIn,
  ZoomOut,
  X,
  Eye,
  EyeOff,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type {
  GenerationJob,
  QuizData,
  QuizQuestion,
  FlashcardData,
  FlashCard,
  MindMapData,
  MindMapNode,
  DataTableData,
} from '../types'

// ── Main Component ──

interface ContentPreviewProps {
  job: GenerationJob
  resultUrl: string
}

export function ContentPreview({ job, resultUrl }: ContentPreviewProps) {
  switch (job.artifactType) {
    case 'audio':
      return <AudioPreview url={resultUrl} title={job.title} />
    case 'video':
      return <VideoPreview url={resultUrl} title={job.title} />
    case 'slide_deck':
      return <PresentationPreview url={resultUrl} job={job} />
    case 'quiz':
      return <QuizPreview data={job.contentData as QuizData | null} url={resultUrl} />
    case 'flashcards':
      return <FlashcardPreview data={job.contentData as FlashcardData | null} url={resultUrl} />
    case 'report':
      return <ReportPreview url={resultUrl} />
    case 'infographic':
      return <InfographicPreview url={resultUrl} title={job.title} />
    case 'data_table':
      return <DataTablePreview data={job.contentData as DataTableData | null} url={resultUrl} />
    case 'mind_map':
      return <MindMapPreview data={job.contentData as MindMapData | null} url={resultUrl} />
    default:
      return <GenericPreview url={resultUrl} />
  }
}

// ── PreviewCard (shared wrapper) ──

function PreviewCard({
  children,
  title,
  icon,
  url,
}: {
  children: React.ReactNode
  title: string
  icon: string
  url: string
}) {
  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>
        </div>
        <a
          href={url}
          download
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <Download className="h-3.5 w-3.5" /> İndir
        </a>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Loading / Error helpers ──

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
      {message && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  )
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <AlertCircle className="h-8 w-8" style={{ color: 'var(--color-error)' }} />
      <p className="text-sm text-center" style={{ color: 'var(--color-error)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Tekrar Dene
        </button>
      )}
    </div>
  )
}

// ── 1. AudioPreview (custom player with S3 direct streaming) ──

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function AudioPreview({ url, title }: { url: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // S3 presigned URL al — dogrudan S3'ten stream (Range request destekli)
  useEffect(() => {
    const separator = url.includes('?') ? '&' : '?'
    fetch(`${url}${separator}stream=true`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Stream URL alinamadi')))
      .then((data) => setStreamUrl(data.streamUrl))
      .catch(() => setStreamUrl(url)) // fallback: proxy URL
  }, [url])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }
    const onTimeUpdate = () => {
      if (!isDragging) setCurrentTime(audio.currentTime)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0) }
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onError = () => {
      setIsLoading(false)
      setError('Ses dosyasi yuklenemedi. Tekrar deneyin.')
    }

    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('error', onError)
    }
  }, [streamUrl, isDragging])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { audio.play().catch(() => {}) } else { audio.pause() }
  }, [])

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !isFinite(audio.duration)) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds))
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const v = parseFloat(e.target.value)
    audio.volume = v
    setVolume(v)
    if (v > 0 && audio.muted) { audio.muted = false; setIsMuted(false) }
  }, [])

  // Seek via click/drag on progress bar
  const seekToPosition = useCallback((clientX: number) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar || !isFinite(audio.duration)) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const time = ratio * audio.duration
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    seekToPosition(e.clientX)

    const onMove = (ev: MouseEvent) => seekToPosition(ev.clientX)
    const onUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [seekToPosition])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <PreviewCard title={title} icon="🎙️" url={url}>
      {streamUrl && <audio ref={audioRef} src={streamUrl} preload="auto" />}

      {error ? (
        <ErrorBlock
          message={error}
          onRetry={() => {
            setError(null)
            setIsLoading(true)
            const audio = audioRef.current
            if (audio) { audio.load(); audio.play().catch(() => {}) }
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="group relative h-2 cursor-pointer rounded-full"
            style={{ background: 'var(--color-border)' }}
            onMouseDown={handleProgressMouseDown}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: 'var(--color-primary-light)', width: `${progress}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'var(--color-primary)',
                width: `${progress}%`,
                transition: isDragging ? 'none' : 'width 150ms linear',
              }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100"
              style={{
                background: 'var(--color-primary)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                left: `calc(${progress}% - 8px)`,
                transition: isDragging ? 'none' : 'left 150ms linear, opacity 200ms ease',
              }}
            />
          </div>

          {/* Time */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {formatTime(currentTime)}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            {/* Volume */}
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1 w-16 cursor-pointer accent-[var(--color-primary)]"
            />

            <div className="flex-1" />

            {/* Skip back */}
            <button
              type="button"
              onClick={() => skip(-10)}
              className="flex h-9 w-9 items-center justify-center rounded-xl icon-btn"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <SkipBack className="h-4.5 w-4.5" />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading && !isPlaying}
              className="flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{
                background: 'var(--color-primary)',
                boxShadow: '0 2px 8px rgba(13,150,104,0.3)',
                opacity: isLoading && !isPlaying ? 0.6 : 1,
                transition: 'opacity 200ms ease, transform 100ms ease',
              }}
            >
              {isLoading && !isPlaying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            {/* Skip forward */}
            <button
              type="button"
              onClick={() => skip(10)}
              className="flex h-9 w-9 items-center justify-center rounded-xl icon-btn"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <SkipForward className="h-4.5 w-4.5" />
            </button>

            <div className="flex-1" />
            <div className="w-[88px]" /> {/* Volume alanı ile simetri */}
          </div>
        </div>
      )}
    </PreviewCard>
  )
}

// ── 2. VideoPreview ──

function VideoPreview({ url, title }: { url: string; title: string }) {
  return (
    <PreviewCard title={title} icon="🎬" url={url}>
      <video
        controls
        preload="metadata"
        className="w-full rounded-xl"
        style={{ maxHeight: 500, objectFit: 'contain', background: '#000' }}
        src={url}
      />
    </PreviewCard>
  )
}

// ── 3. PresentationPreview ──

function PresentationPreview({ url, job }: { url: string; job: GenerationJob }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    setLoading(true)
    setError(null)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('PDF yüklenemedi')
        return res.blob()
      })
      .then((blob) => {
        if (revoked) return
        const objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch((err) => {
        if (!revoked) setError(err instanceof Error ? err.message : 'Yükleme hatası')
      })
      .finally(() => {
        if (!revoked) setLoading(false)
      })

    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return (
    <PreviewCard title={job.title} icon="📊" url={url}>
      {loading && <LoadingSpinner message="Sunum yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={() => window.location.reload()} />}
      {blobUrl && (
        <iframe
          src={blobUrl}
          className="w-full rounded-xl"
          style={{ height: '85vh', minHeight: 700, border: 'none' }}
          title={job.title}
        />
      )}
    </PreviewCard>
  )
}

// ── 4. QuizPreview ──

/** NotebookLM quiz verisini normalize eder.
 * NotebookLM iki farklı format dönebilir:
 *  - Eski: {question, options: string[], correctAnswer: number}
 *  - Yeni: {question, answerOptions: [{text, isCorrect, rationale}], hint} */
function normalizeQuizData(raw: Record<string, unknown>): QuizData {
  const questions = (raw.questions ?? raw.quiz ?? []) as Record<string, unknown>[]
  return {
    title: (raw.title as string) ?? 'Quiz',
    questions: questions.map((q, i) => {
      // Zaten normalize edilmişse doğrudan döndür
      if (Array.isArray(q.options) && typeof q.options[0] === 'string') {
        return q as unknown as QuizQuestion
      }
      // NotebookLM answerOptions formatı
      const answerOptions = (q.answerOptions ?? q.answer_options ?? []) as { text: string; isCorrect?: boolean; is_correct?: boolean }[]
      const options = answerOptions.map((o) => o.text)
      const correctIndex = answerOptions.findIndex((o) => o.isCorrect === true || o.is_correct === true)
      return {
        id: (q.id as string | number) ?? i,
        question: (q.question as string) ?? '',
        options,
        correctAnswer: correctIndex >= 0 ? correctIndex : 0,
        explanation: (q.hint ?? q.explanation ?? q.rationale) as string | undefined,
      }
    }),
  }
}

function QuizPreview({ data: initialData, url }: { data: QuizData | null; url: string }) {
  const [data, setData] = useState<QuizData | null>(
    initialData ? normalizeQuizData(initialData as unknown as Record<string, unknown>) : null,
  )
  const [currentQ, setCurrentQ] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Veri yüklenemedi')
      const json = await res.json()
      setData(normalizeQuizData(json))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (!initialData) {
      void fetchData()
    }
  }, [initialData, fetchData])

  const questions = data?.questions ?? []
  const total = questions.length
  const rawQuestion = questions[currentQ]
  // Runtime guard: answerOptions formatında gelen sorular için options oluştur
  const question: QuizQuestion | undefined = rawQuestion
    ? {
        ...rawQuestion,
        options: rawQuestion.options ?? ((rawQuestion as unknown as Record<string, unknown>).answerOptions as { text: string }[] ?? []).map((o: { text: string }) => o.text),
      }
    : undefined

  const handleOptionClick = (index: number) => {
    if (selectedOption !== null) return
    setSelectedOption(index)
    setShowAnswer(true)
  }

  const goTo = (index: number) => {
    setCurrentQ(index)
    setSelectedOption(null)
    setShowAnswer(false)
  }

  const getOptionStyle = (index: number): React.CSSProperties => {
    if (selectedOption === null || !showAnswer || !question) {
      return { background: 'var(--color-surface-hover)' }
    }
    if (index === question.correctAnswer) {
      return { background: 'var(--color-success)', color: 'white' }
    }
    if (index === selectedOption && index !== question.correctAnswer) {
      return { background: 'var(--color-error)', color: 'white' }
    }
    return { background: 'var(--color-surface-hover)' }
  }

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

  return (
    <PreviewCard title={data?.title ?? 'Quiz'} icon="❓" url={url}>
      {loading && <LoadingSpinner message="Quiz yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={fetchData} />}
      {!loading && !error && question && (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-medium rounded-full px-3 py-1"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
            >
              Soru {currentQ + 1} / {total}
            </span>
          </div>

          {/* Question */}
          <p className="text-base font-bold leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            {question.question}
          </p>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {(question.options ?? []).map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleOptionClick(index)}
                disabled={selectedOption !== null}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors"
                style={{
                  ...getOptionStyle(index),
                  cursor: selectedOption !== null ? 'default' : 'pointer',
                }}
              >
                <span className="font-semibold shrink-0">
                  {optionLabels[index] ?? index + 1}.
                </span>
                <span className="flex-1">{option}</span>
                {showAnswer && index === question.correctAnswer && (
                  <span className="shrink-0">✅</span>
                )}
                {showAnswer &&
                  selectedOption === index &&
                  index !== question.correctAnswer && (
                    <span className="shrink-0">❌</span>
                  )}
              </button>
            ))}
          </div>

          {/* Toggle Answer */}
          <button
            type="button"
            onClick={() => {
              if (!showAnswer && selectedOption === null) {
                setShowAnswer(true)
              } else {
                setShowAnswer(!showAnswer)
              }
            }}
            className="flex items-center gap-1.5 self-start rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
          >
            {showAnswer ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Cevabı Gizle
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Cevabı Göster
              </>
            )}
          </button>

          {/* Explanation */}
          {showAnswer && question.explanation && (
            <div
              className="rounded-xl p-3 text-sm leading-relaxed"
              style={{
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                borderLeft: '3px solid var(--color-primary)',
              }}
            >
              <span className="font-semibold">Açıklama: </span>
              {question.explanation}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => goTo(currentQ - 1)}
              disabled={currentQ === 0}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Önceki
            </button>
            <button
              type="button"
              onClick={() => goTo(currentQ + 1)}
              disabled={currentQ >= total - 1}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              Sonraki <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {!loading && !error && total === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Bu quizde henüz soru bulunmuyor.
        </p>
      )}
    </PreviewCard>
  )
}

// ── 5. FlashcardPreview ──

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function FlashcardPreview({
  data: initialData,
  url,
}: {
  data: FlashcardData | null
  url: string
}) {
  const [data, setData] = useState<FlashcardData | null>(initialData)
  const [cards, setCards] = useState<FlashCard[]>(initialData?.cards ?? [])
  const [currentCard, setCurrentCard] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Veri yüklenemedi')
      const json = (await res.json()) as FlashcardData
      setData(json)
      setCards(json.cards)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (!initialData) {
      void fetchData()
    }
  }, [initialData, fetchData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const total = cards.length
  const card: FlashCard | undefined = cards[currentCard]

  const navigate = (index: number) => {
    setCurrentCard(index)
    setFlipped(false)
  }

  const handleShuffle = () => {
    setCards(shuffleArray(cards))
    setCurrentCard(0)
    setFlipped(false)
  }

  const progressPercent = total > 0 ? ((currentCard + 1) / total) * 100 : 0

  return (
    <PreviewCard title={data?.title ?? 'Bilgi Kartları'} icon="🃏" url={url}>
      {/* Flip CSS */}
      <style>{`
        .fc-flip-container { perspective: 1000px; }
        .fc-flip-card { transition: transform 0.5s; transform-style: preserve-3d; }
        .fc-flip-card.fc-flipped { transform: rotateY(180deg); }
        .fc-flip-front, .fc-flip-back { backface-visibility: hidden; position: absolute; inset: 0; }
        .fc-flip-back { transform: rotateY(180deg); }
      `}</style>

      {loading && <LoadingSpinner message="Kartlar yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={fetchData} />}
      {!loading && !error && card && (
        <div className="flex flex-col gap-4">
          {/* Card */}
          <div className="fc-flip-container">
            <div
              className={`fc-flip-card relative min-h-[250px] cursor-pointer rounded-xl ${flipped ? 'fc-flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.code === 'Enter') setFlipped((f) => !f)
              }}
            >
              {/* Front */}
              <div
                className="fc-flip-front flex items-center justify-center rounded-xl p-6"
                style={{
                  background: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <p
                  className="text-lg font-semibold text-center leading-relaxed"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {card.front}
                </p>
              </div>
              {/* Back */}
              <div
                className="fc-flip-back flex items-center justify-center rounded-xl p-6"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                }}
              >
                <p className="text-base text-center leading-relaxed">{card.back}</p>
              </div>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Kartı çevirmek için tıklayın veya Space tuşuna basın
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              {currentCard + 1} / {total}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--color-surface-hover)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, background: 'var(--color-primary)' }}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(currentCard - 1)}
              disabled={currentCard === 0}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Önceki
            </button>
            <button
              type="button"
              onClick={handleShuffle}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              <Shuffle className="h-3.5 w-3.5" /> Karıştır
            </button>
            <button
              type="button"
              onClick={() => navigate(currentCard + 1)}
              disabled={currentCard >= total - 1}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              Sonraki <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {!loading && !error && total === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Henüz bilgi kartı bulunmuyor.
        </p>
      )}
    </PreviewCard>
  )
}

// ── 6. ReportPreview — Markdown rendering ──

function renderMarkdown(md: string): string {
  const html = md
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
  return `<p>${html}</p>`
}

function ReportPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Rapor yüklenemedi')
      const text = await res.text()
      setContent(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <PreviewCard title="Rapor" icon="📝" url={url}>
      {loading && <LoadingSpinner message="Rapor yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={fetchData} />}
      {!loading && !error && content && (
        <div
          className="prose max-w-none leading-relaxed"
          style={{
            color: 'var(--color-text-primary)',
            ['--tw-prose-headings' as string]: 'var(--color-text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}
    </PreviewCard>
  )
}

// ── 7. InfographicPreview — Zoomable image + lightbox ──

function InfographicPreview({ url, title }: { url: string; title: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  useEffect(() => {
    if (!zoomed) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [zoomed])

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = prev + delta
      if (next < 0.5) return 0.5
      if (next > 3) return 3
      return next
    })
  }

  return (
    <PreviewCard title={title} icon="🖼️" url={url}>
      {/* Thumbnail */}
      <div className="flex justify-center">
        <img
          src={url}
          alt={title}
          className="max-w-full rounded-xl cursor-zoom-in"
          style={{ maxHeight: 500, objectFit: 'contain' }}
          onClick={() => {
            setZoomed(true)
            setZoomLevel(1)
          }}
        />
      </div>
      <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
        Büyütmek için görsele tıklayın
      </p>

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setZoomed(false)}
        >
          {/* Prevent closing when clicking image/controls */}
          <div
            className="relative flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustZoom(-0.5)}
                className="flex items-center justify-center rounded-full p-2 transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-white min-w-[4rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => adjustZoom(0.5)}
                className="flex items-center justify-center rounded-full p-2 transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="flex items-center justify-center rounded-full p-2 transition-opacity hover:opacity-80 ml-4"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Zoomed image */}
            <div className="overflow-auto" style={{ maxWidth: '90vw', maxHeight: '80vh' }}>
              <img
                src={url}
                alt={title}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </PreviewCard>
  )
}

// ── 8. DataTablePreview ──

function DataTablePreview({
  data: initialData,
  url,
}: {
  data: DataTableData | null
  url: string
}) {
  const [headers, setHeaders] = useState<string[]>(initialData?.headers ?? [])
  const [rows, setRows] = useState<string[][]>(initialData?.rows ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Veri yüklenemedi')
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('json')) {
        const json = (await res.json()) as DataTableData
        setHeaders(json.headers)
        setRows(json.rows)
      } else {
        const text = await res.text()
        const lines = text.trim().split('\n')
        const parsedHeaders = lines[0].split(',').map((h) => h.trim())
        const parsedRows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()))
        setHeaders(parsedHeaders)
        setRows(parsedRows)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (!initialData) {
      void fetchData()
    }
  }, [initialData, fetchData])

  return (
    <PreviewCard title="Veri Tablosu" icon="📊" url={url}>
      {loading && <LoadingSpinner message="Tablo yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={fetchData} />}
      {!loading && !error && headers.length > 0 && (
        <div className="overflow-auto rounded-xl" style={{ maxHeight: 500, border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="sticky top-0"
                style={{
                  background: 'var(--color-surface-hover)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-xs font-semibold whitespace-nowrap"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    background: rIdx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-2 whitespace-nowrap"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && headers.length === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Tabloda veri bulunmuyor.
        </p>
      )}
    </PreviewCard>
  )
}

// ── 9. MindMapPreview — Pure CSS tree ──

function TreeNode({ node, depth }: { node: MindMapNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors"
        style={{
          color: depth === 0 ? 'var(--color-primary)' : 'var(--color-text-primary)',
          fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400,
          fontSize: Math.max(12, 15 - depth),
          cursor: hasChildren ? 'pointer' : 'default',
        }}
      >
        {hasChildren ? (expanded ? '▼' : '▶') : '●'} {node.label}
      </button>
      {expanded && hasChildren && (
        <div
          style={{
            borderLeft: '2px solid var(--color-border)',
            marginLeft: 8,
            paddingLeft: 12,
          }}
        >
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function MindMapPreview({
  data: initialData,
  url,
}: {
  data: MindMapData | null
  url: string
}) {
  const [data, setData] = useState<MindMapData | null>(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Veri yüklenemedi')
      const json = (await res.json()) as MindMapData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (!initialData) {
      void fetchData()
    }
  }, [initialData, fetchData])

  return (
    <PreviewCard title={data?.title ?? 'Zihin Haritası'} icon="🧠" url={url}>
      {loading && <LoadingSpinner message="Zihin haritası yükleniyor..." />}
      {error && <ErrorBlock message={error} onRetry={fetchData} />}
      {!loading && !error && data?.rootNode && (
        <div className="overflow-auto py-2" style={{ maxHeight: 600 }}>
          <TreeNode node={data.rootNode} depth={0} />
        </div>
      )}
      {!loading && !error && !data?.rootNode && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Zihin haritası verisi bulunamadı.
        </p>
      )}
    </PreviewCard>
  )
}

// ── 10. GenericPreview — Fallback ──

function GenericPreview({ url }: { url: string }) {
  return (
    <PreviewCard title="Dosya" icon="📄" url={url}>
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div
          className="flex items-center justify-center h-16 w-16 rounded-2xl"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <Download className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
          Bu format için önizleme desteklenmiyor.
        </p>
        <a
          href={url}
          download
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <Download className="h-4 w-4" /> Dosyayı İndir
        </a>
      </div>
    </PreviewCard>
  )
}
