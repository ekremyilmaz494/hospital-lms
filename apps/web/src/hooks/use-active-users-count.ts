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
 * G3.2 — Super-admin tarafı: 'active-users' Presence kanalının state'ini okur.
 *
 * Bu hook subscribe ETMEZ — `usePresenceTracker` (her oturumda çalışır) kanalı
 * zaten join eder. Aynı kanala iki kez `.on()` çağırmak Supabase'de "cannot add
 * presence callbacks after joining a channel" hatası verir. Çözüm: yalnızca
 * `presenceState()`'i 2s'de bir poll et. Kanal henüz join'lenmediyse boş dönüyor,
 * presence-tracker 5s gecikmeli mount oluyor — kısa bir gecikme normal.
 */
export function useActiveUsersCount(): ActiveUsersState {
  const [state, setState] = useState<ActiveUsersState>(EMPTY)

  useEffect(() => {
    const supabase = createClient()

    const tick = () => {
      const ch = supabase.getChannels().find(c => c.topic === 'realtime:active-users')
      if (!ch) return
      const presenceState = ch.presenceState<PresenceEntry>()
      const entries = Object.values(presenceState).flat()
      const counts = { super_admin: 0, admin: 0, staff: 0 }
      for (const e of entries) {
        const role = e.role as keyof typeof counts
        if (role in counts) counts[role]++
      }
      setState({ total: entries.length, byRole: counts, list: entries })
    }

    tick()
    const interval = setInterval(tick, 2000)
    return () => clearInterval(interval)
  }, [])

  return state
}
