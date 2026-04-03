'use client'

// AI İçerik Stüdyosu — Ana sayfa
// 4 adımlı wizard: Belge Yükle → İstek Yaz → Format Seç → Üret & Değerlendir
// Google bağlantısı yoksa banner gösterir ve üretimi engeller

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Check, ChevronRight, ChevronLeft, Settings, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { useFetch } from '@/hooks/use-fetch'

import { useDocumentUpload } from './hooks/use-document-upload'
import { useGeneration } from './hooks/use-generation'
import { useEvaluation } from './hooks/use-evaluation'

import { DocumentUploader } from './components/document-uploader'
import { PromptComposer } from './components/prompt-composer'
import { FormatSelector } from './components/format-selector'
import { GenerationProgress } from './components/generation-progress'
import { ContentPreview } from './components/content-preview'
import { EvaluationPanel } from './components/evaluation-panel'
import { ConnectionRequiredBanner } from './components/connection-required-banner'

import { FORMAT_CONFIGS, DEFAULT_COMMON_SETTINGS } from './lib/format-config'
import { PROMPT_TEMPLATES } from './lib/prompt-templates'
import type { OutputFormat, PromptTemplate } from './types'

const STEPS = [
  { id: 1, label: 'Belge Yükle', description: 'PDF, DOCX, TXT veya MD' },
  { id: 2, label: 'İstek Yaz', description: 'Şablon seç veya özel yaz' },
  { id: 3, label: 'Format Seç', description: 'Podcast, video, quiz...' },
  { id: 4, label: 'Üret & Değerlendir', description: 'İçeriği incele ve kaydet' },
]

interface ConnectionStatus {
  connected: boolean
  email: string | null
  status: string
}

export default function AIContentStudioPage() {
  const [step, setStep] = useState(1)
  const [customInstructions, setCustomInstructions] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat | null>(null)
  const [formatOptions, setFormatOptions] = useState<Record<string, string>>({})
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultLoading, setResultLoading] = useState(false)

  // Google bağlantı durumu
  const { data: connectionData } = useFetch<ConnectionStatus>('/api/admin/ai-content-studio/auth/status')
  const isConnected = connectionData?.connected ?? false

  const { documents, uploading, error: uploadError, uploadFiles, removeDocument } = useDocumentUpload()
  const { job, starting, error: genError, startGeneration, reset: resetGeneration } = useGeneration()
  const {
    evaluation,
    evaluationNote,
    setEvaluationNote,
    saving,
    error: evalError,
    savedId,
    evaluate,
    approve,
    discard,
    reset: resetEvaluation,
  } = useEvaluation(job?.id ?? null)

  // Format options — format değişince format-specific default'lar + ortak ayarları koru
  const handleFormatChange = (format: OutputFormat) => {
    setSelectedFormat(format)
    const cfg = FORMAT_CONFIGS.find((f) => f.id === format)
    const defaults: Record<string, string> = { ...DEFAULT_COMMON_SETTINGS }
    if (cfg?.options) {
      cfg.options.forEach((opt) => { defaults[opt.key] = opt.default })
    }
    setFormatOptions((prev) => ({
      ...defaults,
      duration: prev.duration ?? defaults.duration,
      tone: prev.tone ?? defaults.tone,
      audience: prev.audience ?? defaults.audience,
      language: prev.language ?? defaults.language,
    }))
  }

  const handleOptionChange = (key: string, value: string) => {
    setFormatOptions((prev) => ({ ...prev, [key]: value }))
  }

  // Üretim başlatma
  const handleStartGeneration = useCallback(async () => {
    if (!selectedFormat || documents.length === 0) return

    const documentText = documents.map((d) => `[${d.name}]`).join('\n')
    const documentTitle = documents[0]?.name ?? 'Belge'

    await startGeneration({
      format: selectedFormat,
      audioFormat: formatOptions['audio_format'],
      videoStyle: formatOptions['video_style'],
      documentText,
      documentTitle,
      customInstructions: customInstructions || undefined,
    })
  }, [selectedFormat, documents, formatOptions, customInstructions, startGeneration])

  // Adım 3'ten 4'e geçince üretimi başlat
  const handleNext = async () => {
    if (step === 3) {
      setStep(4)
      await handleStartGeneration()
    } else {
      setStep((s) => Math.min(s + 1, 4))
    }
  }

  // Tekrar üret — mevcut ayarlarla yeniden üretim
  const handleRegenerate = async () => {
    resetGeneration()
    resetEvaluation()
    setResultUrl(null)
    await handleStartGeneration()
  }

  // Job tamamlandığında result URL'ini oluştur
  useEffect(() => {
    if (job?.status === 'completed' && job.id && !resultUrl && !resultLoading) {
      setResultLoading(true)
      // Doğrudan API endpoint'ini result URL olarak kullan
      setResultUrl(`/api/admin/ai-content-studio/result/${job.id}`)
      setResultLoading(false)
    }
  }, [job?.status, job?.id, resultUrl, resultLoading])

  const canProceedStep1 = documents.length > 0
  const canProceedStep2 = true
  const canProceedStep3 = selectedFormat !== null && isConnected

  const canNext =
    step === 1 ? canProceedStep1 :
    step === 2 ? canProceedStep2 :
    step === 3 ? canProceedStep3 :
    false

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                AI İçerik Stüdyosu
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                NotebookLM ile eğitim içeriği üretin
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bağlantı durumu badge */}
            {isConnected && connectionData?.email && (
              <div
                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
                style={{ borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
                  {connectionData.email}
                </span>
              </div>
            )}

            {/* Settings linki */}
            <Link
              href="/admin/ai-content-studio/settings"
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              title="Google Hesap Ayarları"
            >
              <Settings className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            </Link>
          </div>
        </div>
      </BlurFade>

      {/* Bağlantı yoksa banner */}
      {!isConnected && connectionData !== null && (
        <BlurFade delay={0.03}>
          <div className="mb-6">
            <ConnectionRequiredBanner />
          </div>
        </BlurFade>
      )}

      <div className="flex gap-6 lg:gap-8">
        {/* Step indicator — sol kenar */}
        <BlurFade delay={0.05}>
          <div className="hidden w-48 shrink-0 lg:block">
            <div
              className="sticky top-6 rounded-2xl border p-4 space-y-1"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {STEPS.map((s, i) => {
                const done = s.id < step
                const active = s.id === step
                const locked = s.id > step
                const canClick = done || active

                return (
                  <div key={s.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => canClick && setStep(s.id)}
                        disabled={!canClick}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300"
                        style={{
                          background: done ? 'var(--color-primary)' : active ? 'var(--color-primary-light)' : 'var(--color-bg)',
                          color: done ? '#fff' : active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          border: active ? '2px solid var(--color-primary)' : done ? 'none' : '2px solid var(--color-border)',
                          cursor: canClick ? 'pointer' : 'default',
                        }}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.id}
                      </button>
                      {i < STEPS.length - 1 && (
                        <div
                          className="mt-1 w-0.5 flex-1"
                          style={{ height: 24, background: done ? 'var(--color-primary)' : 'var(--color-border)' }}
                        />
                      )}
                    </div>
                    <div className="pb-4 pt-0.5">
                      <p
                        className="text-[12px] font-semibold leading-tight"
                        style={{ color: active ? 'var(--color-text-primary)' : locked ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
                      >
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                        {s.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </BlurFade>

        {/* Ana içerik paneli */}
        <div className="flex-1 min-w-0">
          <BlurFade key={step} delay={0.08}>
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              {/* Panel başlığı */}
              <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {step}
                  </span>
                  <h2 className="text-[16px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    {STEPS[step - 1].label}
                  </h2>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                  {STEPS[step - 1].description}
                </p>
                {/* Mobil step dots */}
                <div className="flex gap-1.5 mt-3 lg:hidden">
                  {STEPS.map((s) => (
                    <div
                      key={s.id}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: s.id === step ? 24 : 8,
                        background: s.id <= step ? 'var(--color-primary)' : 'var(--color-border)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Adım içeriği */}
              {step === 1 && (
                <DocumentUploader
                  documents={documents}
                  uploading={uploading}
                  error={uploadError}
                  onUpload={uploadFiles}
                  onRemove={removeDocument}
                />
              )}

              {step === 2 && (
                <PromptComposer
                  templates={PROMPT_TEMPLATES}
                  value={customInstructions}
                  onChange={setCustomInstructions}
                  onTemplateSelect={setSelectedTemplate}
                />
              )}

              {step === 3 && (
                <FormatSelector
                  formats={FORMAT_CONFIGS}
                  selected={selectedFormat}
                  onChange={handleFormatChange}
                  formatOptions={formatOptions}
                  onOptionChange={handleOptionChange}
                />
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <GenerationProgress
                    job={job}
                    starting={starting}
                    error={genError}
                    onReset={() => { resetGeneration(); resetEvaluation(); setStep(3) }}
                  />

                  {job?.status === 'completed' && resultUrl && (
                    <>
                      <ContentPreview job={job} resultUrl={resultUrl} />
                      <EvaluationPanel
                        job={job}
                        evaluation={evaluation}
                        evaluationNote={evaluationNote}
                        saving={saving}
                        savedId={savedId}
                        error={evalError}
                        onEvaluate={evaluate}
                        onApprove={approve}
                        onDiscard={async () => { await discard(); resetGeneration(); resetEvaluation(); setStep(1) }}
                        onRegenerate={handleRegenerate}
                        onNoteChange={setEvaluationNote}
                      />
                    </>
                  )}

                  {job?.status === 'completed' && resultLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div
                        className="h-6 w-6 animate-spin rounded-full border-2 border-transparent"
                        style={{ borderTopColor: 'var(--color-primary)' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </BlurFade>

          {/* Navigasyon butonları */}
          {step < 4 && (
            <BlurFade delay={0.12}>
              <div className="mt-4 flex items-center justify-between">
                {step > 1 ? (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Geri
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  {step === 3 && !isConnected && (
                    <span className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
                      Önce Google hesabınızı bağlayın
                    </span>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canNext || starting}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-all disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                      boxShadow: canNext ? 'var(--shadow-md)' : undefined,
                    }}
                    title={step === 3 && !isConnected ? 'Önce Google hesabınızı bağlayın' : undefined}
                  >
                    {step === 3 ? (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Üretimi Başlat
                      </>
                    ) : (
                      <>
                        {step === 1 && !canProceedStep1 ? 'Belge yükleyin' : 'Devam Et'}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </BlurFade>
          )}
        </div>
      </div>
    </div>
  )
}
