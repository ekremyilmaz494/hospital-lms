'use client'

/**
 * Offline Queue Provider — sadece staff layout'unda mount edilmeli.
 * Browser online event'inde ve ilk yüklemede kuyruğu flush eder.
 * iOS Safari'de BackgroundSync yoktur; bu fallback o eksikliği kapatır.
 */
import { useEffect } from 'react'
import { flushQueue } from '@/lib/offline-queue'

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // İlk yükleme: bekleyen varsa gönder
    flushQueue().catch(() => {})

    const handleOnline = () => flushQueue().catch(() => {})
    const handleFocus = () => flushQueue().catch(() => {})

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return <>{children}</>
}
