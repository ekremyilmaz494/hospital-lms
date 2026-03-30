'use client'

import { useParams, useRouter } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useEffect, useRef, useState, useCallback } from 'react'

interface TrainingInfo {
  id: string
  title: string
  description: string | null
  category: string | null
  scormEntryPoint: string | null
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

// Declare the SCORM API on window
declare global {
  interface Window {
    API?: ScormAPI
  }
}

interface ScormAPI {
  LMSInitialize: (param: string) => string
  LMSGetValue: (key: string) => string
  LMSSetValue: (key: string, value: string) => string
  LMSCommit: (param: string) => string
  LMSFinish: (param: string) => string
  LMSGetLastError: () => string
  LMSGetErrorString: (code: string) => string
  LMSGetDiagnostic: (code: string) => string
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

  // Sync ref with state
  useEffect(() => {
    attemptRef.current = attempt
  }, [attempt])

  /** PATCH the attempt data */
  const patchAttempt = useCallback(async (data: Record<string, unknown>) => {
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
      // Silent fail for tracking updates
    }
    return null
  }, [id])

  /** Debounced patch */
  const debouncedPatch = useCallback((data: Record<string, unknown>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      patchAttempt(data)
    }, 2000)
  }, [patchAttempt])

  /** Initialize SCORM attempt */
  useEffect(() => {
    if (!training || initialized.current) return
    initialized.current = true

    async function initAttempt() {
      if (!training!.scormEntryPoint) {
        setStatus('error')
        setErrorMsg('Bu egitim icin SCORM icerik bulunamadi')
        return
      }
      try {
        // Try to get existing attempt
        const getRes = await fetch(`/api/exam/${id}/scorm/tracking`)
        if (getRes.ok) {
          const existing = await getRes.json()
          if (existing) {
            setAttempt(existing)
            setStatus('ready')
            return
          }
        }

        // Create new attempt
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
          setErrorMsg(err.error || 'SCORM oturumu baslatilamadi')
          setStatus('error')
        }
      } catch {
        setErrorMsg('SCORM oturumu baslatilamadi')
        setStatus('error')
      }
    }

    initAttempt()
  }, [training, id])

  /** Set up SCORM API bridge on window */
  useEffect(() => {
    if (status !== 'ready') return

    // SCORM 1.2 data store
    const cmiData: Record<string, string> = {
      'cmi.core.student_id': '',
      'cmi.core.student_name': '',
      'cmi.core.lesson_status': attemptRef.current?.lessonStatus || 'not attempted',
      'cmi.core.score.raw': attemptRef.current?.score?.toString() || '',
      'cmi.core.score.min': '0',
      'cmi.core.score.max': '100',
      'cmi.core.total_time': attemptRef.current?.totalTime || '0000:00:00',
      'cmi.core.lesson_location': '',
      'cmi.core.exit': '',
      'cmi.suspend_data': attemptRef.current?.suspendData || '',
      'cmi.core.session_time': '0000:00:00',
      'cmi.completion_status': attemptRef.current?.completionStatus || 'unknown',
      'cmi.success_status': attemptRef.current?.successStatus || 'unknown',
    }

    const api: ScormAPI = {
      LMSInitialize: () => 'true',
      LMSGetValue: (key: string) => {
        return cmiData[key] ?? ''
      },
      LMSSetValue: (key: string, value: string) => {
        cmiData[key] = value

        // Map SCORM keys to our tracking data
        const patchData: Record<string, unknown> = {}

        if (key === 'cmi.core.lesson_status') {
          patchData.lessonStatus = value
        } else if (key === 'cmi.core.score.raw') {
          patchData.score = parseFloat(value) || 0
        } else if (key === 'cmi.core.total_time' || key === 'cmi.core.session_time') {
          patchData.totalTime = value
        } else if (key === 'cmi.suspend_data') {
          patchData.suspendData = value
        } else if (key === 'cmi.completion_status') {
          patchData.completionStatus = value
        } else if (key === 'cmi.success_status') {
          patchData.successStatus = value
        }

        if (Object.keys(patchData).length > 0) {
          debouncedPatch(patchData)
        }

        // Check for completion
        if (key === 'cmi.core.lesson_status' && (value === 'passed' || value === 'completed')) {
          setStatus('completed')
        }

        return 'true'
      },
      LMSCommit: () => {
        // Immediate save
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        const data: Record<string, unknown> = {}
        if (cmiData['cmi.core.lesson_status']) data.lessonStatus = cmiData['cmi.core.lesson_status']
        if (cmiData['cmi.core.score.raw']) data.score = parseFloat(cmiData['cmi.core.score.raw']) || 0
        if (cmiData['cmi.suspend_data']) data.suspendData = cmiData['cmi.suspend_data']
        if (cmiData['cmi.core.total_time']) data.totalTime = cmiData['cmi.core.total_time']
        if (cmiData['cmi.completion_status']) data.completionStatus = cmiData['cmi.completion_status']
        if (cmiData['cmi.success_status']) data.successStatus = cmiData['cmi.success_status']
        patchAttempt(data)
        return 'true'
      },
      LMSFinish: () => {
        // Final save
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        const data: Record<string, unknown> = {}
        if (cmiData['cmi.core.lesson_status']) data.lessonStatus = cmiData['cmi.core.lesson_status']
        if (cmiData['cmi.core.score.raw']) data.score = parseFloat(cmiData['cmi.core.score.raw']) || 0
        if (cmiData['cmi.suspend_data']) data.suspendData = cmiData['cmi.suspend_data']
        if (cmiData['cmi.core.total_time']) data.totalTime = cmiData['cmi.core.total_time']
        if (cmiData['cmi.completion_status']) data.completionStatus = cmiData['cmi.completion_status']
        if (cmiData['cmi.success_status']) data.successStatus = cmiData['cmi.success_status']
        patchAttempt(data)
        return 'true'
      },
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => '',
      LMSGetDiagnostic: () => '',
    }

    window.API = api

    return () => {
      delete window.API
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [status, debouncedPatch, patchAttempt])

  if (isLoading) return <PageLoading />

  // Error state
  if (status === 'error') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <svg
            className="mx-auto mb-4 h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: 'var(--color-error)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p
            className="text-sm font-semibold mb-2"
            style={{ color: 'var(--color-error)' }}
          >
            {errorMsg || 'Bir hata olustu'}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 rounded-xl px-6 py-2.5 text-sm font-semibold"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Geri Don
          </button>
        </div>
      </div>
    )
  }

  // Completion state
  if (status === 'completed') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <svg
            className="mx-auto mb-4 h-14 w-14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: 'var(--color-primary)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            Egitim Tamamlandi
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {training?.title} egitimini basariyla tamamladiniz.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{
              background: 'var(--color-primary)',
            }}
          >
            Panele Don
          </button>
        </div>
      </div>
    )
  }

  // Loading attempt
  if (status === 'loading') return <PageLoading />

  // SCORM player
  const scormSrc = `/api/exam/${id}/scorm/content/${training?.scormEntryPoint || 'index.html'}`

  const lessonStatus = attempt?.lessonStatus || 'not attempted'

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
            }}
          >
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}
          >
            {training?.title || 'SCORM Egitim'}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status badge */}
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: lessonStatus === 'passed' || lessonStatus === 'completed'
                ? 'rgba(13, 150, 104, 0.1)'
                : 'rgba(148, 163, 184, 0.15)',
              color: lessonStatus === 'passed' || lessonStatus === 'completed'
                ? 'var(--color-primary)'
                : 'var(--color-text-muted)',
            }}
          >
            {lessonStatus === 'passed' ? 'Basarili' :
             lessonStatus === 'completed' ? 'Tamamlandi' :
             lessonStatus === 'incomplete' ? 'Devam Ediyor' :
             lessonStatus === 'failed' ? 'Basarisiz' :
             'Baslanmadi'}
          </span>

          {/* Exit button */}
          <button
            onClick={() => {
              // Trigger LMSFinish before navigating
              if (window.API) {
                window.API.LMSFinish('')
              }
              router.back()
            }}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Cikis
          </button>
        </div>
      </div>

      {/* SCORM iframe */}
      <div className="flex-1 relative">
        <iframe
          src={scormSrc}
          className="absolute inset-0 h-full w-full border-0"
          title="SCORM Icerik"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  )
}
