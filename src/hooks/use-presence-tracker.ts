'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth-store'

/**
 * G3.2 — Her oturum açmış kullanıcı bu hook'u çalıştırır.
 * Supabase Presence kanalına katılarak aktif kullanıcı sayısına katkıda bulunur.
 * Super-admin bu kanalı izleyerek anlık aktif kullanıcı sayısını görebilir.
 */
export function usePresenceTracker() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()

    const channel = supabase.channel('active-users', {
      config: { presence: { key: user.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        // no-op: tracker side doesn't need to react to sync
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            role: user.role,
            organizationId: user.organizationId ?? null,
            joinedAt: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, user?.role, user?.organizationId])
}
