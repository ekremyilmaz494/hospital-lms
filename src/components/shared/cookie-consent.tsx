'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Cookie, X, Settings, Check } from 'lucide-react'

type CookiePreferences = {
  essential: true // her zaman true
  functional: boolean
  analytics: boolean
}

const COOKIE_CONSENT_KEY = 'lms_cookie_consent'
const COOKIE_PREFS_KEY = 'lms_cookie_prefs'

function getStoredConsent(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'true'
}

function getStoredPrefs(): CookiePreferences {
  if (typeof window === 'undefined') return { essential: true, functional: false, analytics: false }
  try {
    const raw = localStorage.getItem(COOKIE_PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { essential: true, functional: false, analytics: false }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState<CookiePreferences>({ essential: true, functional: false, analytics: false })

  useEffect(() => {
    const hasConsent = getStoredConsent()
    if (!hasConsent) {
      // Kısa gecikme — sayfa yüklendikten sonra göster
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
    setPrefs(getStoredPrefs())
  }, [])

  const acceptAll = useCallback(() => {
    const allPrefs: CookiePreferences = { essential: true, functional: true, analytics: true }
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(allPrefs))
    setPrefs(allPrefs)
    setVisible(false)
  }, [])

  const acceptSelected = useCallback(() => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(prefs))
    setVisible(false)
  }, [prefs])

  const rejectOptional = useCallback(() => {
    const minPrefs: CookiePreferences = { essential: true, functional: false, analytics: false }
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(minPrefs))
    setPrefs(minPrefs)
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6">
      <div
        className="mx-auto max-w-3xl rounded-2xl p-5 md:p-6 shadow-2xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
            >
              <Cookie className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Cerez Kullanimi
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                6698 sayili KVKK uyarinca bilgilendirme
              </p>
            </div>
          </div>
          <button
            onClick={rejectOptional}
            className="shrink-0 rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Bu platform, hizmetlerimizi sunmak icin zorunlu cerezler kullanir. Bunun yaninda, deneyiminizi
          iyilestirmek icin islevsel ve anonim istatistik cerezleri de kullanilabilir. Detayli bilgi icin{' '}
          <Link href="/privacy" className="font-semibold underline" style={{ color: 'var(--color-primary)' }}>
            Gizlilik Politikamizi
          </Link>{' '}
          inceleyebilirsiniz.
        </p>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 space-y-3 rounded-xl p-4" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            {/* Zorunlu */}
            <label className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Zorunlu Cerezler</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Oturum, guvenlik, temel islevler (kapatılamaz)</p>
              </div>
              <div className="flex h-5 w-9 items-center rounded-full px-0.5" style={{ background: 'var(--color-primary)' }}>
                <div className="h-4 w-4 rounded-full bg-white translate-x-4" />
              </div>
            </label>

            {/* Fonksiyonel */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Islevsel Cerezler</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Dil tercihi, tema ayarlari</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, functional: !p.functional }))}
                className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors"
                style={{ background: prefs.functional ? 'var(--color-primary)' : 'var(--color-border)' }}
              >
                <div
                  className="h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: prefs.functional ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </label>

            {/* Analitik */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Istatistik Cerezleri</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Anonim kullanim istatistikleri</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors"
                style={{ background: prefs.analytics ? 'var(--color-primary)' : 'var(--color-border)' }}
              >
                <div
                  className="h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: prefs.analytics ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </button>
            </label>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <Settings className="h-3.5 w-3.5" />
            {showSettings ? 'Ayarlari Gizle' : 'Cerez Ayarlari'}
          </button>

          {showSettings ? (
            <button
              onClick={acceptSelected}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-colors"
              style={{ background: 'var(--color-primary)' }}
            >
              <Check className="h-3.5 w-3.5" />
              Secilenleri Kabul Et
            </button>
          ) : (
            <>
              <button
                onClick={rejectOptional}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Sadece Zorunlu
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                style={{ background: 'var(--color-primary)' }}
              >
                <Check className="h-3.5 w-3.5" />
                Tumunu Kabul Et
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
