'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

/** Kullanıcı çevrimdışıyken service worker tarafından yönlendirilen fallback sayfa */
export default function OfflinePage() {
  const [lastPath, setLastPath] = useState<string>('/staff/dashboard')

  useEffect(() => {
    // Önceki sayfayı sessionStorage'dan oku (PWAInstallPrompt ve layout bunu yazar)
    const saved = sessionStorage.getItem('lastVisitedPath')
    if (saved && saved !== '/offline') setLastPath(saved) // eslint-disable-line
  }, [])

  const handleRetry = () => {
    window.location.href = lastPath
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* İkon */}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-error-bg), rgba(239,68,68,0.15))',
          boxShadow: '0 8px 30px rgba(239,68,68,0.15)',
        }}
      >
        <WifiOff className="h-10 w-10" style={{ color: 'var(--color-error)' }} />
      </div>

      {/* Başlık */}
      <div className="space-y-2">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        >
          İnternet bağlantınız yok
        </h1>
        <p className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Bağlantı kurulduğunda kaldığınız yerden devam edebilirsiniz.
          Daha önce görüntülediğiniz sayfalar çevrimdışı da açılabilir.
        </p>
      </div>

      {/* Tekrar Dene */}
      <button
        onClick={handleRetry}
        className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
          boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)',
          transition: 'opacity 0.15s, transform 0.1s',
        }}
      >
        <RefreshCw className="h-4 w-4" />
        Tekrar Dene
      </button>

      {/* Logo */}
      <div className="mt-4 flex items-center gap-2 opacity-40">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          H
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          Devakent Hastanesi
        </span>
      </div>
    </div>
  )
}
