'use client'

// AI İçerik Stüdyosu — Yeni İçerik Oluşturma Wizard'ı
// 4 adımlı akış: Belge Yükle → Talimat Yaz → Format Seç → Üret
// Üretim başladığında detay sayfasına yönlendirir

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  Palette,
  Rocket,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Check,
  Loader2,
  Settings,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'
import { useFetch } from '@/hooks/use-fetch'
import { useAiGenerationStore } from '@/store/ai-generation-store'

import { useDocumentUpload } from '../hooks/use-document-upload'
import { useGeneration } from '../hooks/use-generation'

import { DocumentUploader } from '../components/document-uploader'
import { PromptComposer } from '../components/prompt-composer'
import { FormatSelector } from '../components/format-selector'
import { ConnectionRequiredBanner } from '../components/connection-required-banner'

import { FORMAT_CONFIGS, DEFAULT_COMMON_SETTINGS } from '../lib/format-config'
import { PROMPT_TEMPLATES } from '../lib/prompt-templates'
import type { ArtifactType, PromptTemplate, GoogleConnectionStatus } from '../types'

// ── Adım Tanımları ──
const STEPS = [
  { id: 0, label: 'Belge Yükle', description: 'PDF, DOCX, TXT, URL veya YouTube', icon: Upload },
  { id: 1, label: 'Talimat Yaz', description: 'Şablon seç veya özel talimat yaz', icon: FileText },
  { id: 2, label: 'Format Seç', description: 'Ses, video, quiz, infografik...', icon: Palette },
  { id: 3, label: 'Üret', description: 'Özeti kontrol et ve başlat', icon: Rocket },
]

export default function AIContentStudioNewPage() {
  const router = useRouter()

  // ── Hooks ──
  const docUpload = useDocumentUpload()
  const generation = useGeneration()
  const addJob = useAiGenerationStore((s) => s.addJob)
  const { data: connectionStatus, refetch: refetchConnection } = useFetch<GoogleConnectionStatus>(
    '/api/admin/ai-content-studio/auth/status',
  )

  const isConnected = connectionStatus?.connected === true

  // Settings'ten dönünce bağlantı durumunu yenile
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchConnection()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refetchConnection])

  // ── State ──
  const [step, setStep] = useState(0)
  const [instructions, setInstructions] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<ArtifactType | null>(null)
  const [formatOptions, setFormatOptions] = useState<Record<string, string>>({
    ...DEFAULT_COMMON_SETTINGS,
  })
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // ── Belge analizinden gelen konular ──
  const suggestedTopics = useMemo(() => {
    const topics: string[] = []
    for (const doc of docUpload.documents) {
      if (doc.keyTopics) topics.push(...doc.keyTopics)
    }
    return [...new Set(topics)]
  }, [docUpload.documents])

  // ── Belge analizinden gelen önerilen formatlar ──
  const suggestedFormats = useMemo(() => {
    if (selectedTemplate?.suggestedFormats) {
      return selectedTemplate.suggestedFormats as ArtifactType[]
    }
    return undefined
  }, [selectedTemplate])

  // ── Template seçilince instruction'ı doldur ──
  const handleTemplateSelect = (template: PromptTemplate | null) => {
    setSelectedTemplate(template)
    if (template) {
      setInstructions(template.template)
    }
  }

  // ── Format option değişimi ──
  const handleOptionChange = (key: string, value: string) => {
    setFormatOptions((prev) => ({ ...prev, [key]: value }))
  }

  // ── Adım geçiş validasyonu ──
  const canNext = step === 0
    ? docUpload.allReady
    : step === 1
      ? true // Talimat opsiyonel
      : step === 2
        ? selectedFormat !== null
        : false

  // ── Adım navigasyonu ──
  const goNext = () => {
    if (step < 3 && canNext) setStep(step + 1)
  }
  const goBack = () => {
    if (step > 0) setStep(step - 1)
  }

  // ── Üretim Başlat ──
  const handleStartGeneration = async () => {
    if (!selectedFormat || !docUpload.notebookId) return

    setGenerating(true)
    setGenerateError(null)
    try {
      const title = docUpload.documents[0]?.fileName ?? 'AI İçerik'

      const jobId = await generation.startGeneration({
        notebookId: docUpload.notebookId,
        artifactType: selectedFormat,
        title,
        instructions: instructions || undefined,
        settings: formatOptions,
      })

      if (jobId) {
        addJob({
          id: jobId,
          title,
          artifactType: selectedFormat,
          status: 'queued',
          progress: 0,
          createdAt: new Date().toISOString(),
        })
        router.push(`/admin/ai-content-studio/${jobId}`)
      } else {
        setGenerateError(generation.error ?? 'Üretim başlatılamadı')
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setGenerating(false)
    }
  }

  // ── Format label ──
  const selectedFormatConfig = selectedFormat
    ? FORMAT_CONFIGS.find((f) => f.id === selectedFormat)
    : null

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--color-bg)' }}>
      {/* ── Header ── */}
      <BlurFade delay={0}>
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/admin/ai-content-studio"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kütüphane
            </Link>

            <div className="flex items-center gap-2">
              {/* Bağlantı durumu badge */}
              {isConnected && connectionStatus?.email && (
                <div
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
                  style={{
                    borderColor: 'var(--color-success)',
                    background: 'var(--color-success-bg)',
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--color-success)' }} />
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
                    {connectionStatus.email}
                  </span>
                </div>
              )}
              <Link
                href="/admin/ai-content-studio/settings"
                className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors duration-200"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                title="Ayarlar"
              >
                <Settings className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                Yeni İçerik Oluştur
              </h1>
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                Adım {step + 1} / {STEPS.length} — {STEPS[step].description}
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Bağlantı yoksa banner */}
      {!isConnected && connectionStatus !== null && (
        <BlurFade delay={0.03}>
          <div className="mb-6">
            <ConnectionRequiredBanner />
          </div>
        </BlurFade>
      )}

      {/* ── Ana Layout: Sidebar + Content ── */}
      <div className="flex gap-6 lg:gap-8">
        {/* Sol Sidebar — Adım Göstergesi (desktop) */}
        <BlurFade delay={0.05}>
          <div className="hidden w-52 shrink-0 lg:block">
            <div
              className="sticky top-6 rounded-2xl border p-4"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {STEPS.map((s, i) => {
                const done = s.id < step
                const active = s.id === step
                const locked = s.id > step
                const canClick = done

                return (
                  <div key={s.id}>
                    <button
                      onClick={() => canClick && setStep(s.id)}
                      disabled={!canClick}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-200"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                        cursor: canClick ? 'pointer' : 'default',
                      }}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200"
                        style={{
                          background: done
                            ? 'var(--color-primary)'
                            : active
                              ? 'var(--color-primary-light)'
                              : 'var(--color-bg)',
                          color: done
                            ? '#fff'
                            : active
                              ? 'var(--color-primary)'
                              : 'var(--color-text-muted)',
                          border: active
                            ? '2px solid var(--color-primary)'
                            : done
                              ? 'none'
                              : '2px solid var(--color-border)',
                        }}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.id + 1}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p
                          className="text-[12px] font-semibold leading-tight"
                          style={{
                            color: active
                              ? 'var(--color-text-primary)'
                              : locked
                                ? 'var(--color-text-muted)'
                                : 'var(--color-text-secondary)',
                          }}
                        >
                          {s.label}
                        </p>
                        <p
                          className="mt-0.5 text-[10px] leading-snug"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {s.description}
                        </p>
                      </div>
                    </button>

                    {/* Adımlar arası çizgi */}
                    {i < STEPS.length - 1 && (
                      <div className="ml-5 flex justify-center py-1">
                        <div
                          className="h-4 w-0.5 rounded-full"
                          style={{
                            background: done
                              ? 'var(--color-primary)'
                              : 'var(--color-border)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </BlurFade>

        {/* Ana İçerik Paneli */}
        <div className="min-w-0 flex-1">
          <BlurFade key={step} delay={0.08}>
            <div
              className="rounded-2xl border p-6"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Panel başlığı */}
              <div
                className="mb-6 border-b pb-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {step + 1}
                  </span>
                  <h2
                    className="text-[16px] font-bold"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                  >
                    {STEPS[step].label}
                  </h2>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                  {STEPS[step].description}
                </p>

                {/* Mobil dot indicators */}
                <div className="mt-3 flex gap-1.5 lg:hidden">
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

              {/* ── Adım 0: Belge Yükle ── */}
              {step === 0 && (
                <DocumentUploader
                  documents={docUpload.documents}
                  uploading={docUpload.uploading}
                  error={docUpload.error}
                  allReady={docUpload.allReady}
                  processingCount={docUpload.processingCount}
                  onUpload={docUpload.uploadFiles}
                  onAddSource={docUpload.addSource}
                  onRemove={docUpload.removeDocument}
                />
              )}

              {/* ── Adım 1: Talimat Yaz ── */}
              {step === 1 && (
                <PromptComposer
                  templates={PROMPT_TEMPLATES}
                  value={instructions}
                  onChange={setInstructions}
                  onTemplateSelect={handleTemplateSelect}
                  selectedTemplate={selectedTemplate}
                  suggestedTopics={suggestedTopics}
                />
              )}

              {/* ── Adım 2: Format Seç ── */}
              {step === 2 && (
                <FormatSelector
                  formats={FORMAT_CONFIGS}
                  selected={selectedFormat}
                  onChange={setSelectedFormat}
                  formatOptions={formatOptions}
                  onOptionChange={handleOptionChange}
                  suggestedFormats={suggestedFormats}
                />
              )}

              {/* ── Adım 3: Özet + Başlat ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <h3
                    className="text-[15px] font-bold"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
                  >
                    Üretim Özeti
                  </h3>

                  {/* Özet kartları */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Belgeler */}
                    <div
                      className="rounded-xl border p-4"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Upload className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          Belgeler
                        </span>
                      </div>
                      <p
                        className="text-[14px] font-bold"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
                      >
                        {docUpload.documents.length} belge
                      </p>
                      <p className="mt-1 truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {docUpload.documents.map((d) => d.fileName).join(', ')}
                      </p>
                    </div>

                    {/* Format */}
                    <div
                      className="rounded-xl border p-4"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          Format
                        </span>
                      </div>
                      {selectedFormatConfig && (
                        <p className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {selectedFormatConfig.icon} {selectedFormatConfig.label}
                        </p>
                      )}
                      {selectedFormatConfig && (
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          Tahmini süre: ~{selectedFormatConfig.estimatedMinutes} dk
                        </p>
                      )}
                    </div>

                    {/* Talimat */}
                    {instructions && (
                      <div
                        className="rounded-xl border p-4 sm:col-span-2"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                          <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Talimat
                          </span>
                        </div>
                        <p
                          className="line-clamp-3 text-[13px]"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {instructions}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Başlat butonu */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleStartGeneration}
                      disabled={generating || !isConnected}
                      className="flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-[14px] font-bold text-white transition-transform duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Üretim Başlatılıyor...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          Üretimi Başlat
                        </>
                      )}
                    </button>
                  </div>

                  {generateError && (
                    <p className="text-center text-[12px] mt-2" style={{ color: 'var(--color-error)' }}>
                      {generateError}
                    </p>
                  )}

                  {!isConnected && (
                    <p className="text-center text-[12px]" style={{ color: 'var(--color-warning)' }}>
                      Üretim için önce Google hesabınızı bağlayın →{' '}
                      <Link
                        href="/admin/ai-content-studio/settings"
                        className="font-semibold underline"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Ayarlar
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          </BlurFade>

          {/* ── Navigasyon Butonları (adım 3 hariç — orada Başlat butonu var) ── */}
          {step < 3 && (
            <BlurFade delay={0.12}>
              <div className="mt-4 flex items-center justify-between">
                {step > 0 ? (
                  <button
                    onClick={goBack}
                    className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200"
                    style={{
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Geri
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={goNext}
                  disabled={!canNext}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-opacity duration-200 disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
                    boxShadow: canNext ? 'var(--shadow-md)' : undefined,
                  }}
                >
                  {step === 0 && !docUpload.allReady ? 'Belge yükleyin' : 'Devam Et'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </BlurFade>
          )}
        </div>
      </div>
    </div>
  )
}
