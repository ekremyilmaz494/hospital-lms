'use client'

import { useState, useEffect } from 'react'
import { Download, ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { GenerationJob } from '../types'
import { getFormatConfig } from '../lib/format-config'

interface Props {
  job: GenerationJob
  resultUrl: string
}

/* ─── Quiz renderer ─── */
// NotebookLM formatı: { question, answerOptions: [{text, isCorrect, rationale}], hint }
interface AnswerOption {
  text: string
  isCorrect: boolean
  rationale?: string
}

interface QuizQuestion {
  question: string
  answerOptions?: AnswerOption[]
  options?: string[]
  correct?: number
  hint?: string
  explanation?: string
}

function QuizRenderer({ data }: { data: QuizQuestion[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {data.map((q, i) => {
        const isOpen = revealed.has(i)
        // NotebookLM formatı (answerOptions) veya basit format (options) destekle
        const answers: { text: string; isCorrect: boolean; rationale?: string }[] =
          q.answerOptions
            ? q.answerOptions
            : (q.options ?? []).map((opt, j) => ({
                text: typeof opt === 'string' ? opt : String(opt),
                isCorrect: j === (q.correct ?? -1),
              }))

        return (
          <div
            key={i}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={() => toggle(i)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
              style={{ background: 'var(--color-surface)' }}
            >
              <div className="flex gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {i + 1}
                </span>
                <p className="text-[13px] font-semibold leading-snug">{q.question}</p>
              </div>
              {isOpen
                ? <ChevronUp className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
                : <ChevronDown className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
              }
            </button>
            {isOpen && (
              <div className="space-y-1.5 px-4 pb-4" style={{ background: 'var(--color-bg)' }}>
                {answers.map((opt, j) => (
                  <div
                    key={j}
                    className="rounded-lg px-3 py-2 text-[12px]"
                    style={{
                      background: opt.isCorrect ? 'var(--color-success-bg)' : 'var(--color-surface)',
                      borderLeft: opt.isCorrect ? '3px solid var(--color-success)' : '3px solid transparent',
                      fontWeight: opt.isCorrect ? 700 : 400,
                      color: opt.isCorrect ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{String.fromCharCode(65 + j)})</span>
                      <span className="flex-1">{opt.text}</span>
                      {opt.isCorrect && <span>✓</span>}
                    </div>
                    {opt.rationale && opt.isCorrect && (
                      <p className="mt-1 text-[11px] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                        {opt.rationale}
                      </p>
                    )}
                  </div>
                ))}
                {(q.hint ?? q.explanation) && (
                  <p
                    className="mt-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
                    style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                  >
                    💡 {q.hint ?? q.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Flashcard renderer ─── */
interface Flashcard {
  front: string
  back: string
}

function FlashcardRenderer({ data }: { data: Flashcard[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setFlipped((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {data.map((card, i) => {
        const isFlipped = flipped.has(i)
        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="group relative min-h-[120px] rounded-2xl border p-5 text-left transition-all duration-300"
            style={{
              borderColor: isFlipped ? 'var(--color-primary)' : 'var(--color-border)',
              background: isFlipped ? 'var(--color-primary-light)' : 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                style={{
                  background: isFlipped ? 'rgba(13,150,104,0.15)' : 'var(--color-bg)',
                  color: isFlipped ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                {isFlipped ? 'Cevap' : 'Soru'} {i + 1}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {isFlipped ? '🔄 geri çevir' : '🔄 çevir'}
              </span>
            </div>
            <p className="text-[13px] font-semibold leading-snug">
              {isFlipped ? card.back : card.front}
            </p>
          </button>
        )
      })}
    </div>
  )
}

/* ─── JSON renderer dispatcher ─── */
function JsonRenderer({ job, data }: { job: GenerationJob; data: unknown }) {
  // String data — raw metin olarak göster
  if (typeof data === 'string') {
    return (
      <pre
        className="overflow-x-auto rounded-xl p-4 text-[12px] leading-relaxed whitespace-pre-wrap"
        style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
      >
        {data}
      </pre>
    )
  }

  if (job.format === 'QUIZ' && Array.isArray(data)) {
    return <QuizRenderer data={data as QuizQuestion[]} />
  }
  if ((job.format === 'FLASHCARDS' || job.format === 'AUDIO_QUIZ') && Array.isArray(data)) {
    return <FlashcardRenderer data={data as Flashcard[]} />
  }
  return (
    <pre
      className="overflow-x-auto rounded-xl p-4 text-[11px] leading-relaxed"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

/* ─── Main component ─── */
export function ContentPreview({ job, resultUrl }: Props) {
  const [zoom, setZoom] = useState(1)
  const [jsonData, setJsonData] = useState<unknown>(null)
  const [jsonLoaded, setJsonLoaded] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoaded, setTextLoaded] = useState(false)
  const formatCfg = getFormatConfig(job.format)
  // resultType'ı önce job'dan al, yoksa format config'den
  const resultType = job.resultType ?? formatCfg.resultType

  const loadJson = async () => {
    if (jsonLoaded) return
    try {
      const res = await fetch(resultUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        // NotebookLM quiz: {title, questions: [...]}
        // NotebookLM flashcards: {cards: [...]} veya doğrudan dizi
        const items = Array.isArray(parsed)
          ? parsed
          : parsed.questions ?? parsed.cards ?? parsed.items ?? parsed.flashcards ?? parsed
        setJsonData(Array.isArray(items) ? items : parsed)
      } catch {
        // JSON parse edilemedi — raw text olarak göster
        setJsonData(text)
      }
      setJsonLoaded(true)
    } catch (err) {
      console.error('JSON load error:', err)
      setJsonLoaded(true)
    }
  }

  // Auto-load json
  useEffect(() => {
    if (resultType === 'json' && !jsonLoaded) loadJson()
  }, [resultType, jsonLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load text / document
  useEffect(() => {
    if ((resultType !== 'text' && resultType !== 'document') || textLoaded) return
    fetch(resultUrl)
      .then((r) => r.ok ? r.text() : Promise.reject('fetch failed'))
      .then((t) => setTextContent(t))
      .catch(() => {})
      .finally(() => setTextLoaded(true))
  }, [resultType, resultUrl, textLoaded])

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{formatCfg.icon}</span>
          <p className="text-[14px] font-bold">{formatCfg.label} Önizlemesi</p>
        </div>
        <a
          href={resultUrl}
          download
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
        >
          <Download className="h-3.5 w-3.5" />
          İndir
        </a>
      </div>

      {/* İçerik */}
      {resultType === 'audio' && (
        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {/* Waveform placeholder */}
          <div
            className="flex h-16 items-center justify-center gap-0.5 rounded-xl overflow-hidden"
            style={{ background: 'var(--color-bg)' }}
          >
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-full"
                style={{
                  height: `${20 + Math.sin(i * 0.4) * 15 + Math.random() * 20}px`,
                  background: `rgba(13,150,104,${0.3 + Math.sin(i * 0.3) * 0.3})`,
                }}
              />
            ))}
          </div>
          <audio
            controls
            src={resultUrl}
            className="w-full"
            style={{ outline: 'none' }}
          />
        </div>
      )}

      {resultType === 'video' && (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          <video
            controls
            src={resultUrl}
            className="w-full"
            style={{ maxHeight: '400px', background: '#000' }}
          />
        </div>
      )}

      {resultType === 'text' && (
        <div
          className="rounded-2xl border p-6 overflow-auto"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', maxHeight: '600px' }}
        >
          {!textLoaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : textContent ? (
            <pre
              className="text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
            >
              {textContent}
            </pre>
          ) : (
            <p className="text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              İçerik yüklenemedi.
            </p>
          )}
        </div>
      )}

      {resultType === 'document' && (
        <div
          className="rounded-2xl border p-6 overflow-auto"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', maxHeight: '600px' }}
        >
          {!textLoaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : textContent ? (
            <pre
              className="text-[13px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
            >
              {textContent}
            </pre>
          ) : (
            <p className="text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              İçerik yüklenemedi.
            </p>
          )}
        </div>
      )}

      {resultType === 'json' && (
        <div>
          {!jsonLoaded ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: 'var(--color-primary)' }} />
            </div>
          ) : jsonData ? (
            <JsonRenderer job={job} data={jsonData} />
          ) : (
            <p className="text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              İçerik yüklenemedi.
            </p>
          )}
        </div>
      )}

      {resultType === 'image' && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
        >
          {/* Zoom kontrolleri */}
          <div
            className="flex items-center gap-2 border-b px-4 py-2"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <span className="text-[11px] font-semibold mr-auto" style={{ color: 'var(--color-text-muted)' }}>
              Yakınlaştır
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="rounded-lg p-1.5"
              style={{ background: 'var(--color-bg)' }}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-[12px] font-bold" style={{ minWidth: 40, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="rounded-lg p-1.5"
              style={{ background: 'var(--color-bg)' }}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="rounded-lg p-1.5"
              style={{ background: 'var(--color-bg)' }}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-auto p-4" style={{ maxHeight: '500px' }}>
            <img
              src={resultUrl}
              alt="İnfografik"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease',
                maxWidth: '100%',
              }}
            />
          </div>
        </div>
      )}

      {resultType === 'presentation' && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl border p-8"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: 'var(--color-bg)' }}>
            <span className="text-4xl">📽️</span>
          </div>
          <div className="text-center">
            <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Sunum Dosyası Hazır
            </p>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              PowerPoint (.pptx) dosyası tarayıcıda önizlenemez.
            </p>
          </div>
          <a
            href={resultUrl}
            download
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <Download className="h-4 w-4" />
            Sunumu İndir (.pptx)
          </a>
        </div>
      )}

      {/* Fallback — tanınmayan format */}
      {!['audio', 'video', 'text', 'json', 'image', 'presentation', 'document'].includes(resultType) && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl border p-8"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-bg)' }}>
            <span className="text-3xl">📦</span>
          </div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Desteklenmeyen format — dosyayı indirin
          </p>
          <a
            href={resultUrl}
            download
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all"
            style={{ background: 'var(--color-primary)' }}
          >
            <Download className="h-4 w-4" />
            İndir
          </a>
        </div>
      )}
    </div>
  )
}
