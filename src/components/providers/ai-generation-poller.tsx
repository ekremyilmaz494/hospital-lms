'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAiGenerationStore, type ActiveJob } from '@/store/ai-generation-store'
import { useToast } from '@/components/shared/toast'

function getPollingInterval(job: ActiveJob): number {
  const ageMs = Date.now() - new Date(job.createdAt).getTime()
  if (ageMs < 30_000) return 2000
  if (ageMs < 5 * 60_000) return 5000
  return 10_000
}

interface StatusData {
  jobId: string
  status: string
  progress: number
  error?: string | null
}

export function AiGenerationPoller() {
  const pathname = usePathname()
  const { toast } = useToast()

  const activeJobs = useAiGenerationStore((s) => s.activeJobs)
  const addJob = useAiGenerationStore((s) => s.addJob)
  const updateJob = useAiGenerationStore((s) => s.updateJob)
  const removeJob = useAiGenerationStore((s) => s.removeJob)
  const addNotification = useAiGenerationStore((s) => s.addNotification)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seededRef = useRef(false)
  const notifiedRef = useRef(new Set<string>())

  // Seed: ilk mount'ta aktif job'ları API'den çek
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true

    fetch('/api/admin/ai-content-studio/list?status=generating&limit=10')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.items) return
        for (const item of data.items as Array<{ id: string; title: string; artifactType: string; status: string; progress: number; createdAt: string }>) {
          if (!activeJobs[item.id]) {
            addJob({
              id: item.id,
              title: item.title,
              artifactType: item.artifactType,
              status: item.status as ActiveJob['status'],
              progress: item.progress,
              createdAt: item.createdAt,
            })
          }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pollJobs = useCallback(async () => {
    const jobs = Object.values(activeJobs).filter(
      j => j.status === 'queued' || j.status === 'processing' || j.status === 'downloading',
    )
    if (jobs.length === 0) return

    await Promise.all(jobs.map(async (job) => {
      try {
        const res = await fetch(`/api/admin/ai-content-studio/status/${job.id}`)
        if (!res.ok) return
        const data: StatusData = await res.json()

        if (data.status === 'completed') {
          updateJob(job.id, { status: 'completed', progress: 100 })

          addNotification({
            id: job.id,
            title: job.title,
            artifactType: job.artifactType,
            completedAt: new Date().toISOString(),
          })

          const isOnDetailPage = pathname === `/admin/ai-content-studio/${job.id}`
          if (!isOnDetailPage && !notifiedRef.current.has(job.id)) {
            notifiedRef.current.add(job.id)
            toast(`"${job.title}" içeriği hazır!`, 'success', {
              label: 'İncele',
              href: `/admin/ai-content-studio/${job.id}`,
            })
          }

          setTimeout(() => removeJob(job.id), 3000)
        } else if (data.status === 'failed') {
          updateJob(job.id, { status: 'failed', error: data.error || undefined })

          const isOnDetailPage = pathname === `/admin/ai-content-studio/${job.id}`
          if (!isOnDetailPage && !notifiedRef.current.has(job.id)) {
            notifiedRef.current.add(job.id)
            toast(`"${job.title}" üretimi başarısız`, 'error', {
              label: 'Detay',
              href: `/admin/ai-content-studio/${job.id}`,
            })
          }

          setTimeout(() => removeJob(job.id), 5000)
        } else {
          updateJob(job.id, {
            status: data.status as ActiveJob['status'],
            progress: data.progress,
          })
        }
      } catch {
        // Ağ hatalarında sessizce devam et
      }
    }))
  }, [activeJobs, pathname, toast, updateJob, addNotification, removeJob])

  // Interval yönetimi
  useEffect(() => {
    const pendingJobs = Object.values(activeJobs).filter(
      j => j.status === 'queued' || j.status === 'processing' || j.status === 'downloading',
    )

    if (pendingJobs.length > 0) {
      const intervals = pendingJobs.map(getPollingInterval)
      const minInterval = Math.min(...intervals, 10_000)

      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(pollJobs, minInterval)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeJobs, pollJobs])

  return null
}
