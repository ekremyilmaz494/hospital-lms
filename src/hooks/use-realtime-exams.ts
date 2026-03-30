'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth-store'

export interface LiveExamAttempt {
  id: string
  status: string
  attemptNumber: number
  startedAt: string
  user: { id: string; name: string; department: string | null }
  training: { id: string; title: string; examDurationMinutes: number }
  maxAttempts: number
}

const IN_PROGRESS_STATUSES = new Set(['pre_exam', 'watching_videos', 'post_exam'])

/**
 * G7.6 — Admin-side hook that:
 * 1. Fetches current in-progress exam attempts on mount (REST)
 * 2. Subscribes to Supabase Realtime postgres_changes on `exam_attempts`
 *    to receive live INSERT and UPDATE events, keeping the list current.
 */
export function useRealtimeExams() {
  const { user } = useAuthStore()
  const [attempts, setAttempts] = useState<LiveExamAttempt[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchInitial = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/in-progress-exams')
      if (res.ok) {
        const data = await res.json()
        setAttempts(data.attempts ?? [])
      }
    } catch { /* ignore */ } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.id || user.role !== 'admin') return

    fetchInitial()

    const supabase = createClient()

    // postgres_changes on exam_attempts — no org-level filter at DB level here;
    // the API layer already scopes to the org, but for Realtime we re-fetch on change.
    const channel = supabase
      .channel(`exam-attempts:${user.organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT + UPDATE + DELETE
          schema: 'public',
          table: 'exam_attempts',
        },
        () => {
          // Re-fetch on any change to keep the list accurate with full join data
          fetchInitial()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, user?.role, user?.organizationId, fetchInitial])

  const activeCount = attempts.filter(a => IN_PROGRESS_STATUSES.has(a.status)).length

  return { attempts, isLoading, activeCount }
}
