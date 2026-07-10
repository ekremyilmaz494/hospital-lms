'use client'

import { useParams, useRouter } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, LogOut, Play, ArrowLeft } from 'lucide-react'
import { createScormApi, type ScormTrackingFields } from '@/lib/scorm/api-factory'
import type { ScormVersion } from '@/lib/scorm/timespan'

interface TrainingInfo {
  id: string
  title: string
  description: string | null
  category: string | null
  scormEntryPoint: string | null
  scormVersion: string | null
}

interface ScormAttempt {
  id: string
  attemptId: string
  suspendData: string | null
  lessonStatus: string | null
  score: number | null
  totalTime: string | null
  completionStatus: string | null
  successStatus: string | null
}

declare global {
  interface Window {
    // SCORM SCO'ları LMS API'sini window zincirinde arar (1.2: API, 2004: API_1484_11).
    API?: unknown
    API_1484_11?: unknown
  }
}

export default function ScormPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: training, isLoading } = useFetch<TrainingInfo>(
    `/api/exam/${id}/info`
  )

  const [attempt, setAttempt] = useState<ScormAttempt | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'completed' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const attemptRef = useRef<ScormAttempt | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    attemptRef.current = attempt
  }, [attempt])

  const patchAttempt = useCallback(async (data: ScormTrackingFields) => {
    try {
      const res = await fetch(`/api/exam/${id}/scorm/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setAttempt(updated)
        return updated
      }
    } catch {
      /* Silent fail */
    }
    return null
  }, [id])

  const debouncedPatch = useCallback((data: ScormTrackingFields) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => { patchAttempt(data) }, 2000)
  }, [patchAttempt])

  useEffect(() => {
    if (!training || initialized.current) return
    initialized.current = true

    async function initAttempt() {
      if (!training!.scormEntryPoint) {
        setStatus('error')
        setErrorMsg('Bu eğitim için SCORM içerik bulunamadı')
        return
      }
      try {
        const getRes = await fetch(`/api/exam/${id}/scorm/tracking`)
        if (getRes.ok) {
          const existing = await getRes.json()
          if (existing) {
            setAttempt(existing)
            setStatus('ready')
            return
          }
        }

        const postRes = await fetch(`/api/exam/${id}/scorm/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (postRes.ok) {
          const newAttempt = await postRes.json()
          setAttempt(newAttempt)
          setStatus('ready')
        } else {
          const err = await postRes.json().catch(() => ({}))
          setErrorMsg(err.error || 'SCORM oturumu başlatılamadı')
          setStatus('error')
        }
      } catch {
        setErrorMsg('SCORM oturumu başlatılamadı')
        setStatus('error')
      }
    }

    initAttempt()
  }, [training, id])

  // Çıkışta finish/terminate çağrısı için (buton unmount'tan önce çağırır).
  const terminateRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (status !== 'ready') return

    const a = attemptRef.current
    const version: ScormVersion = training?.scormVersion === '2004' ? '2004' : '1.2'

    const created = createScormApi({
      version,
      initial: {
        lessonStatus: a?.lessonStatus ?? null,
        score: a?.score ?? null,
        totalTime: a?.totalTime ?? null,
        suspendData: a?.suspendData ?? null,
        completionStatus: a?.completionStatus ?? null,
        successStatus: a?.successStatus ?? null,
      },
      onPersist: (fields) => debouncedPatch(fields),
      onCommit: (fields) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        patchAttempt(fields)
      },
      onComplete: () => setStatus('completed'),
    })

    // SCO'nun window zincirinde bulacağı global'i tak (1.2: API, 2004: API_1484_11).
    const w = window as unknown as Record<string, unknown>
    w[created.globalName] = created.api

    terminateRef.current = () => {
      if (created.globalName === 'API_1484_11') {
        ;(created.api as { Terminate: (p: string) => string }).Terminate('')
      } else {
        ;(created.api as { LMSFinish: (p: string) => string }).LMSFinish('')
      }
    }

    return () => {
      delete w[created.globalName]
      terminateRef.current = null
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [status, training?.scormVersion, debouncedPatch, patchAttempt])

  if (isLoading) return <PageLoading />

  // ── Error state ──
  if (status === 'error') {
    return (
      <div className="sc-center">
        <div className="sc-card">
          <div className="sc-card-icon sc-card-icon-err"><AlertTriangle className="h-6 w-6" /></div>
          <span className="sc-eyebrow">Hata</span>
          <h2>{errorMsg || 'Bir hata oluştu'}</h2>
          <p>SCORM içerik başlatılamadı. Lütfen tekrar dene veya yöneticine başvur.</p>
          <button onClick={() => router.back()} className="sc-btn sc-btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            <span>Geri Dön</span>
          </button>
        </div>
        {sharedStyles()}
      </div>
    )
  }

  // ── Completed state ──
  if (status === 'completed') {
    return (
      <div className="sc-center">
        <div className="sc-card">
          <div className="sc-card-icon sc-card-icon-ok"><CheckCircle2 className="h-7 w-7" /></div>
          <span className="sc-eyebrow">Tamamlandı</span>
          <h2>Eğitim başarıyla tamamlandı</h2>
          <p><em>{training?.title}</em> eğitimini başarıyla bitirdin.</p>
          <button onClick={() => router.push('/staff/my-trainings')} className="sc-btn sc-btn-primary">
            <span>Eğitimlerime Dön</span>
          </button>
        </div>
        {sharedStyles()}
      </div>
    )
  }

  if (status === 'loading') return <PageLoading />

  // ── SCORM player ──
  const scormSrc = `/api/exam/${id}/scorm/content/${training?.scormEntryPoint || 'index.html'}`
  const lessonStatus = attempt?.lessonStatus || 'not attempted'

  const statusLabel =
    lessonStatus === 'passed'     ? 'Başarılı'     :
    lessonStatus === 'completed'  ? 'Tamamlandı'   :
    lessonStatus === 'incomplete' ? 'Devam Ediyor' :
    lessonStatus === 'failed'     ? 'Başarısız'    :
    'Başlanmadı'

  const statusChipClass =
    lessonStatus === 'passed' || lessonStatus === 'completed' ? 'sc-chip-ok' :
    lessonStatus === 'incomplete' ? 'sc-chip-amber' :
    lessonStatus === 'failed' ? 'sc-chip-err' :
    'sc-chip-neutral'

  return (
    <div className="sc-player">
      <header className="sc-header">
        <div className="sc-header-left">
          <div className="sc-header-icon"><Play className="h-4 w-4" fill="currentColor" /></div>
          <div className="sc-header-title">
            <span className="sc-header-eyebrow">SCORM İçerik</span>
            <h1>{training?.title || 'Eğitim'}</h1>
          </div>
        </div>
        <div className="sc-header-right">
          <span className={`sc-chip ${statusChipClass}`}>
            <span className="sc-chip-dot" />
            {statusLabel}
          </span>
          <button
            onClick={() => {
              terminateRef.current?.()
              router.back()
            }}
            className="sc-exit-btn"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Çıkış</span>
          </button>
        </div>
      </header>

      <div className="sc-iframe-wrap">
        <iframe
          src={scormSrc}
          className="sc-iframe"
          title="SCORM İçerik"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <style jsx>{`
        .sc-player {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: #faf7f2;
        }

        .sc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e5e0d5;
          flex-shrink: 0;
        }
        .sc-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .sc-header-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #0a1628;
          color: #faf7f2;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sc-header-title { min-width: 0; }
        .sc-header-eyebrow {
          display: block;
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5b6478;
        }
        .sc-header-title h1 {
          font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
          font-size: 15px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a1628;
          margin: 2px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 420px;
          letter-spacing: -0.01em;
        }

        .sc-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .sc-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .sc-chip-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }
        .sc-chip-ok { background: #eaf6ef; color: #0a7a47; border-color: #c8e6d5; }
        .sc-chip-amber { background: #fef6e7; color: #6a4e11; border-color: #e9c977; }
        .sc-chip-err { background: #fdf5f2; color: #b3261e; border-color: #e9c9c0; }
        .sc-chip-neutral { background: #faf7f2; color: #5b6478; border-color: #e5e0d5; }

        .sc-exit-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          background: transparent;
          color: #5b6478;
          border: 1px solid #e5e0d5;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .sc-exit-btn:hover { background: #fdf5f2; color: #b3261e; border-color: #e9c9c0; }

        .sc-iframe-wrap {
          flex: 1;
          position: relative;
          padding: 20px 24px 24px;
        }
        .sc-iframe {
          position: absolute;
          top: 20px;
          left: 24px;
          right: 24px;
          bottom: 24px;
          width: calc(100% - 48px);
          height: calc(100% - 44px);
          border: 1px solid #e5e0d5;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 4px 20px rgba(10, 10, 10, 0.04);
        }

        @media (max-width: 640px) {
          .sc-header { padding: 12px 16px; }
          .sc-header-title h1 { max-width: 200px; font-size: 13px; }
          .sc-exit-btn span { display: none; }
          .sc-exit-btn { width: 36px; padding: 0; justify-content: center; }
          .sc-iframe-wrap { padding: 12px; }
          .sc-iframe { top: 12px; left: 12px; right: 12px; bottom: 12px; width: calc(100% - 24px); height: calc(100% - 24px); }
        }
      `}</style>
    </div>
  )
}

function sharedStyles() {
  return (
    <style jsx>{`
      .sc-center {
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 20px;
        background: #faf7f2;
      }
      .sc-card {
        width: 100%;
        max-width: 440px;
        padding: 36px 32px;
        background: #ffffff;
        border: 1px solid #e5e0d5;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 12px 40px rgba(10, 10, 10, 0.06);
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .sc-card-icon {
        width: 60px;
        height: 60px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
        color: #faf7f2;
      }
      .sc-card-icon-ok { background: #0a7a47; }
      .sc-card-icon-err { background: #b3261e; }
      .sc-eyebrow {
        display: inline-block;
        font-family: var(--font-display, system-ui);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #5b6478;
        margin-bottom: 6px;
      }
      .sc-card h2 {
        font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif;
        font-size: 24px;
        font-weight: 500;
        font-variation-settings: 'opsz' 42, 'SOFT' 50;
        color: #0a1628;
        letter-spacing: -0.02em;
        margin: 0 0 8px;
      }
      .sc-card p {
        font-size: 13px;
        color: #5b6478;
        line-height: 1.55;
        margin: 0 0 20px;
        max-width: 320px;
      }
      .sc-card p em { font-style: italic; color: #0a1628; font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; }

      .sc-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 48px;
        padding: 0 24px;
        border-radius: 999px;
        font-family: var(--font-display, system-ui);
        font-size: 14px;
        font-weight: 600;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .sc-btn:active { transform: scale(0.97); }
      .sc-btn-ghost { background: transparent; color: #5b6478; border-color: #e5e0d5; }
      .sc-btn-ghost:hover { border-color: #0a1628; color: #0a1628; }
      .sc-btn-primary { background: #0a1628; color: #faf7f2; border-color: #c9a961; box-shadow: inset 0 1px 0 rgba(201, 169, 97, 0.15); }
      .sc-btn-primary :global(svg) { color: #c9a961; }
      .sc-btn-primary:hover { background: #1a1a1a; }
    `}</style>
  )
}
