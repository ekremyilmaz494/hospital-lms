'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { K } from './k-tokens'
import { ARTIFACT_ICONS } from './artifact-icons'
import { StatusBadge } from './status-badge'
import {
  AI_STATUS_POLL_INTERVAL_MS,
  ARTIFACT_TYPE_LABEL_TR,
  type AiArtifactType,
  type AiGenStatus,
} from '@/lib/ai-content-studio/constants'

export interface ActiveJob {
  id: string
  artifactType: AiArtifactType
  status: AiGenStatus
  progress: number
  createdAt: string
}

interface JobStatusUpdate {
  id: string
  status: AiGenStatus
  progress: number
  error?: string
  fileSize?: number
}

interface ActiveJobsListProps {
  jobs: ActiveJob[]
  onJobFinished: (id: string) => void
}

export function ActiveJobsList({ jobs, onJobFinished }: ActiveJobsListProps) {
  const [updates, setUpdates] = useState<Record<string, JobStatusUpdate>>({})
  const intervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const finishedRef = useRef<Set<string>>(new Set())

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/ai-content-studio/${id}/status`)
      if (!res.ok) return
      const json = (await res.json()) as JobStatusUpdate
      setUpdates((prev) => ({ ...prev, [id]: json }))
      if ((json.status === 'completed' || json.status === 'failed') && !finishedRef.current.has(id)) {
        finishedRef.current.add(id)
        const t = intervals.current.get(id)
        if (t) clearInterval(t)
        intervals.current.delete(id)
        onJobFinished(id)
      }
    } catch {
      // sessizce yut — sonraki tick yeniden dener
    }
  }, [onJobFinished])

  useEffect(() => {
    const activeIds = new Set(jobs.map((j) => j.id))

    // Yeni job'lar için interval başlat
    for (const j of jobs) {
      if (j.status !== 'pending' && j.status !== 'processing') continue
      if (intervals.current.has(j.id)) continue
      poll(j.id)
      const t = setInterval(() => poll(j.id), AI_STATUS_POLL_INTERVAL_MS)
      intervals.current.set(j.id, t)
    }

    // Listede olmayan id'lerin interval'ini kapat
    for (const [id, t] of intervals.current.entries()) {
      if (!activeIds.has(id)) {
        clearInterval(t)
        intervals.current.delete(id)
      }
    }

    return () => {
      // unmount: tüm interval'ları temizle
      for (const t of intervals.current.values()) clearInterval(t)
      intervals.current.clear()
    }
  }, [jobs, poll])

  if (jobs.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {jobs.map((j) => {
        const u = updates[j.id]
        const status: AiGenStatus = u?.status ?? j.status
        const progress = u?.progress ?? j.progress ?? 0
        const Icon = ARTIFACT_ICONS[j.artifactType]
        return (
          <div
            key={j.id}
            style={{
              border: `1px solid ${K.BORDER_LIGHT}`,
              borderRadius: 12,
              background: K.SURFACE,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Icon size={18} color={K.PRIMARY} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: K.TEXT_PRIMARY }}>
                    {ARTIFACT_TYPE_LABEL_TR[j.artifactType]}
                  </span>
                  <span style={{ fontSize: 12, color: K.TEXT_MUTED }}>
                    Başlatıldı: {new Date(j.createdAt).toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
              <StatusBadge status={status} />
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: K.BORDER_LIGHT,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  height: '100%',
                  background: status === 'failed' ? K.ERROR : K.PRIMARY,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            {u?.error && (
              <div style={{ fontSize: 12, color: K.ERROR }}>{u.error}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
