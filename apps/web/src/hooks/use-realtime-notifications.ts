'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/store/notification-store'
import { useAuthStore } from '@/store/auth-store'
import type { Notification } from '@/types/database'

export function useRealtimeNotifications() {
  const { user } = useAuthStore()
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on<Notification>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as Notification
          addNotification(notification)

          // Yalnızca kullanıcı daha önce izin verdiyse browser bildirimi göster.
          // İzin isteği burada yapılmaz — kullanıcı eylemi gerektirdiğinden
          // hook içinde otomatik istemek Chrome/Firefox tarafından engellenir.
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, addNotification])
}
