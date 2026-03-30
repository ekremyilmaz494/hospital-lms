'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

const DISMISSED_KEY = 'pwa-install-dismissed-until'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Mobil kullanıcılara PWA kurulum teşviki banner'ı.
 * - "Daha sonra" seçilirse 7 gün tekrar gösterilmez.
 * - Uygulama zaten kuruluysa (standalone mode) hiç gösterilmez.
 * - Desktop'ta gizlenir.
 */
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Zaten standalone / kurulu ise gösterme
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Desktop ise gösterme (768px = md breakpoint)
    if (window.innerWidth >= 768) return
    // "Daha sonra" süresi dolmadıysa gösterme
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!visible || !deferredPrompt) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
    setVisible(false)
  }

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl p-4 shadow-xl md:hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    >
      {/* Uygulama ikonu */}
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
          boxShadow: '0 4px 12px rgba(13,150,104,0.3)',
        }}
      >
        H
      </div>

      {/* Metin */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          Daha hızlı erişim için
        </p>
        <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          Ana ekranınıza ekleyin
        </p>
      </div>

      {/* Butonlar */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          <Smartphone className="h-3.5 w-3.5" />
          Ekle
        </button>
      </div>
    </div>
  )
}
