'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceEntry {
  userId: string
  role: string
  organizationId: string | null
  joinedAt: string
}

interface ActiveUsersState {
  total: number
  byRole: { super_admin: number; admin: number; staff: number }
  list: PresenceEntry[]
}

const EMPTY: ActiveUsersState = { total: 0, byRole: { super_admin: 0, admin: 0, staff: 0 }, list: [] }

/**
 * G3.2 — Super-admin tarafı: 'active-users' Presence kanalını dinler ve
 * anlık aktif kullanıcı sayısını role bazlı olarak döner.
 * Bileşen unmount edildiğinde kanal otomatik temizlenir.
 */
export function useActiveUsersCount(): ActiveUsersState {
  const [state, setState] = useState<ActiveUsersState>(EMPTY)

  useEffect(() => {
    const supabase = createClient()
    // Unique kanal adı: Strict Mode'da iki kez mount edildiğinde "already joined" hatasını önler
    const channel = supabase.channel(`active-users-${Date.now()}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<PresenceEntry>()
        const entries = Object.values(presenceState).flat()

        const counts = { super_admin: 0, admin: 0, staff: 0 }
        for (const e of entries) {
          const role = e.role as keyof typeof counts
          if (role in counts) counts[role]++
        }

        setState({
          total: entries.length,
          byRole: counts,
          list: entries,
        })
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  return state
}
