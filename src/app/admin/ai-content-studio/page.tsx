'use client'

/**
 * AI İçerik Stüdyosu — Hospital LMS admin tarafı.
 * Bağlı NotebookLM hesabı üzerinden sınava/eğitime girdi olabilecek içerikler üretir.
 * Backend: /api/admin/ai-content-studio/* (account, sources/presign, generate, [id]/status, [id]/download, history, delete)
 */

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Sparkles, AlertTriangle, CheckCircle2, Loader2, Zap, History,
} from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/components/shared/toast'
import { K } from '@/components/ai-studio/k-tokens'
import { SourceUploader, type UploadedSource } from '@/components/ai-studio/source-uploader'
import { ArtifactTypeGrid } from '@/components/ai-studio/artifact-type-grid'
import { OptionsPanel } from '@/components/ai-studio/options-panel'
import { ActiveJobsList, type ActiveJob } from '@/components/ai-studio/active-jobs-list'
import { HistoryTable, type HistoryItem } from '@/components/ai-studio/history-table'
import {
  AI_MAX_PROMPT_LEN,
  ARTIFACT_OPTIONS_DEFAULTS,
  type AiArtifactType,
} from '@/lib/ai-content-studio/constants'

interface HealthResponse {
  workerOk: boolean
  connected: boolean
  googleEmail?: string
  reason?: string
}

interface HistoryResponse {
  items: HistoryItem[]
  total: number
  page: number
  limit: number
}

interface GenerateResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  workerJobId?: string
  error?: string
}

const HISTORY_LIMIT = 20

export default function AiContentStudioPage() {
  const { toast: showToast } = useToast()
  const [, startTransition] = useTransition()

  // Klinova AI shared session sağlık durumu
  const healthQuery = useFetch<HealthResponse>('/api/admin/ai-content-studio/health')

  // Form state
  const [sourceFiles, setSourceFiles] = useState<UploadedSource[]>([])
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState<AiArtifactType | null>(null)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Aktif iş listesi (kullanıcı bu sayfada başlattıkları + history'den pending/processing olanlar)
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([])

  // History
  const [page, setPage] = useState(1)
  const historyQuery = useFetch<HistoryResponse>(
    `/api/admin/ai-content-studio?page=${page}&limit=${HISTORY_LIMIT}`,
  )

  // Tipi değiştirince options default'larını uygula
  useEffect(() => {
    if (type) setOptions({ ...ARTIFACT_OPTIONS_DEFAULTS[type] })
  }, [type])

  // History'deki pending/processing'leri activeJobs'a senkronla
  useEffect(() => {
    const items = historyQuery.data?.items ?? []
    const inFlight = items.filter((it) => it.status === 'pending' || it.status === 'processing')
    setActiveJobs((prev) => {
      const map = new Map<string, ActiveJob>()
      for (const j of prev) map.set(j.id, j)
      for (const it of inFlight) {
        if (!map.has(it.id)) {
          map.set(it.id, {
            id: it.id,
            artifactType: it.artifactType,
            status: it.status,
            progress: it.progress,
            createdAt: it.createdAt,
          })
        }
      }
      return Array.from(map.values())
    })
  }, [historyQuery.data])

  const aiReady = Boolean(healthQuery.data?.workerOk && healthQuery.data?.connected)
  const aiReason = healthQuery.data?.reason

  const canSubmit = useMemo(() => {
    if (!aiReady) return false
    if (!type) return false
    if (sourceFiles.length === 0 && sourceUrls.length === 0) return false
    return true
  }, [aiReady, type, sourceFiles, sourceUrls, prompt])

  const handleJobFinished = useCallback((_id: string) => {
    startTransition(() => {
      historyQuery.refetch()
    })
    setActiveJobs((prev) => prev.filter((j) => j.id !== _id))
  }, [historyQuery])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !type) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactType: type,
          prompt: prompt.trim() || undefined,
          sourceFiles,
          sourceUrls,
          options,
          language: 'tr',
        }),
      })
      const json = (await res.json()) as GenerateResponse
      if (!res.ok) {
        showToast(json.error ?? 'Üretim başlatılamadı', 'error')
        return
      }
      showToast('Üretim sıraya alındı', 'success')
      setActiveJobs((prev) => [
        {
          id: json.id,
          artifactType: type,
          status: json.status,
          progress: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      // Formu sıfırla
      setSourceFiles([])
      setSourceUrls([])
      setPrompt('')
      historyQuery.refetch()
    } catch {
      showToast('Sunucuya ulaşılamadı', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, type, prompt, sourceFiles, sourceUrls, options, showToast, historyQuery])

  return (
    <div style={{ background: K.BG, minHeight: '100vh', padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 700, color: K.TEXT_PRIMARY,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <Sparkles size={28} color={K.PRIMARY} />
            AI İçerik Stüdyosu
          </h1>
          <p style={{ margin: '8px 0 0', color: K.TEXT_MUTED, fontSize: 15 }}>
            NotebookLM tabanlı içerik üretimi — kaynaklarınızı yükleyin, podcast, sunum, quiz veya rapor üretin.
          </p>
        </div>

        {/* Klinova AI durumu (shared mode) */}
        {!healthQuery.isLoading && aiReady && (
          <div style={{
            background: K.SUCCESS_BG, border: `1px solid ${K.SUCCESS}`,
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <CheckCircle2 size={16} color={K.SUCCESS} />
            <span style={{ fontSize: 13, color: K.TEXT_SECONDARY, flex: 1, minWidth: 200 }}>
              <strong style={{ color: K.TEXT_PRIMARY }}>Klinova AI</strong> hazır — kaynaklarınızı yükleyip üretim başlatabilirsiniz.
            </span>
          </div>
        )}

        {!healthQuery.isLoading && !aiReady && (
          <div style={{
            background: K.WARNING_BG, border: `1px solid ${K.WARNING}`,
            borderRadius: 16, padding: 20,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <AlertTriangle size={28} color={K.WARNING} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontWeight: 600, color: K.TEXT_PRIMARY, fontSize: 15 }}>
                Klinova AI şu an bakımda
              </div>
              <div style={{ color: K.TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>
                Birkaç saat içinde aktif olacak. Sorun devam ederse Klinova destek hattına bildirin.
                {aiReason && (
                  <span style={{ display: 'block', fontSize: 12, color: K.TEXT_MUTED, marginTop: 4 }}>
                    Detay: {aiReason}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div style={{
          background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`,
          borderRadius: 16, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
          opacity: aiReady ? 1 : 0.55,
          pointerEvents: aiReady ? 'auto' : 'none',
        }}>
          <Section title="1. Kaynaklar" subtitle="Belge yükleyin veya URL ekleyin (en az birini doldurun ya da prompt yazın).">
            <SourceUploader
              files={sourceFiles}
              onFilesChange={setSourceFiles}
              urls={sourceUrls}
              onUrlsChange={setSourceUrls}
              disabled={!aiReady || submitting}
            />
          </Section>

          <Section title="2. Talimat (Prompt)" subtitle="İçeriği nasıl şekillendirmek istediğinizi yazın — opsiyonel.">
            <div style={{ position: 'relative' }}>
              <textarea
                value={prompt}
                disabled={!aiReady || submitting}
                onChange={(e) => setPrompt(e.target.value.slice(0, AI_MAX_PROMPT_LEN))}
                placeholder="Örn: Hemşireler için el hijyeni protokolünü 5 dk podcast formatında özetle. Vurgu noktası: Cerrahi yıkama adımları."
                rows={4}
                style={{
                  width: '100%', padding: 12, borderRadius: 10,
                  border: `1px solid ${K.BORDER}`, background: K.SURFACE,
                  fontSize: 14, color: K.TEXT_PRIMARY, resize: 'vertical',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              <div style={{
                marginTop: 4, fontSize: 12, color: K.TEXT_MUTED, textAlign: 'right',
              }}>
                {prompt.length.toLocaleString('tr-TR')} / {AI_MAX_PROMPT_LEN.toLocaleString('tr-TR')}
              </div>
            </div>
          </Section>

          <Section title="3. İçerik Tipi" subtitle="Üretmek istediğiniz çıktı formatını seçin.">
            <ArtifactTypeGrid
              selected={type}
              onSelect={setType}
              disabled={!aiReady || submitting}
            />
          </Section>

          {type && (
            <Section title="4. Seçenekler" subtitle="Tipe özgü ince ayarlar — varsayılanlar genelde yeterlidir.">
              <OptionsPanel
                type={type}
                value={options}
                onChange={setOptions}
                disabled={!aiReady || submitting}
              />
            </Section>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 12,
              background: !canSubmit || submitting ? K.BORDER : K.PRIMARY,
              color: K.SURFACE, border: 'none',
              fontSize: 15, fontWeight: 700,
              cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
            {!aiReady
              ? 'Klinova AI bakımda'
              : submitting ? 'Gönderiliyor...' : 'Üret'}
          </button>
        </div>

        {/* Aktif işler */}
        {activeJobs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Loader2 size={16} color={K.INFO} className="animate-spin" />
              Aktif üretimler ({activeJobs.length})
            </h2>
            <ActiveJobsList jobs={activeJobs} onJobFinished={handleJobFinished} />
          </div>
        )}

        {/* History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <History size={16} color={K.TEXT_SECONDARY} />
            Geçmiş
          </h2>
          <HistoryTable
            items={historyQuery.data?.items ?? []}
            total={historyQuery.data?.total ?? 0}
            page={page}
            limit={HISTORY_LIMIT}
            isLoading={historyQuery.isLoading}
            onPageChange={setPage}
            onDeleted={() => historyQuery.refetch()}
          />
        </div>
      </div>
    </div>
  )
}

function Section({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: K.TEXT_PRIMARY }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  )
}
