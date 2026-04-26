'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, Settings, Check, ArrowRight } from 'lucide-react'

type CookiePreferences = {
  essential: true
  functional: boolean
  analytics: boolean
}

const COOKIE_CONSENT_KEY = 'lms_cookie_consent'
const COOKIE_PREFS_KEY = 'lms_cookie_prefs'

/* ─── Klinova palette ─── */
const INK = '#063a26'        // deep emerald-ink
const INK_SOFT = '#475569'   // slate
const CREAM = '#f0fdf4'      // emerald cream
const RULE = '#a7f3d0'       // light emerald border
const GOLD = '#10b981'       // emerald primary (semantic name preserved for diff minimalism)

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

/**
 * Çerez onay banner'ı — Klinova dilinde.
 * Soft-mint zemin + emerald-ink border + emerald left-rail accent.
 * Alt kenarda fixed, max-w-3xl merkezli, rounded yok.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState<CookiePreferences>({ essential: true, functional: false, analytics: false })

  useEffect(() => {
    const hasConsent = getStoredConsent()
    if (!hasConsent) {
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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-5">
      <div
        className="mx-auto max-w-3xl relative"
        style={{
          background: '#ffffff',
          border: `1.5px solid ${RULE}`,
          borderLeft: `6px solid ${GOLD}`,
          borderRadius: 0,
          boxShadow: '0 -8px 32px rgba(10, 22, 40, 0.12)',
          fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        }}
      >
        <style>{`
          .ck-display { font-family: var(--font-plus-jakarta-sans), serif; }
          .ck-mono { font-family: var(--font-jetbrains-mono), ui-monospace, monospace; }
        `}</style>

        {/* Header — editorial masthead */}
        <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="ck-mono text-[9px] tracking-[0.32em] mb-1.5"
                style={{ color: GOLD, fontWeight: 700 }}
              >
                № 06 · YASAL BİLGİLENDİRME
              </p>
              <h3
                className="ck-display leading-tight tracking-tight"
                style={{ color: INK, fontSize: '1.25rem', fontWeight: 600 }}
              >
                Çerez <span style={{ fontStyle: 'italic', color: GOLD }}>Kullanımı.</span>
              </h3>
              <p
                className="mt-1 ck-mono text-[10px] tracking-[0.2em] uppercase"
                style={{ color: INK_SOFT }}
              >
                6698 sayılı KVKK uyarınca bilgilendirme
              </p>
            </div>
            <button
              type="button"
              onClick={rejectOptional}
              aria-label="Kapat ve sadece zorunlu çerezleri kabul et"
              className="shrink-0 flex items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                color: INK_SOFT,
                background: 'transparent',
                border: `1px solid ${RULE}`,
                borderRadius: '2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = CREAM; e.currentTarget.style.color = INK; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = INK_SOFT; }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4">
          <p className="text-[13px] leading-relaxed" style={{ color: INK_SOFT }}>
            Bu platform, hizmetlerimizi sunmak için zorunlu çerezler kullanır. Bunun yanında,
            deneyiminizi iyileştirmek için işlevsel ve anonim istatistik çerezleri de kullanılabilir.
            Detaylı bilgi için{' '}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors"
              style={{ color: INK, fontWeight: 600 }}
            >
              Gizlilik Politikası
            </Link>
            &apos;nı inceleyebilirsiniz.
          </p>

          {/* Settings Panel */}
          {showSettings && (
            <div
              className="mt-4 px-4 py-3 space-y-3"
              style={{ background: CREAM, border: `1px solid ${RULE}`, borderLeft: `3px solid ${GOLD}` }}
            >
              <PrefRow
                label="Zorunlu Çerezler"
                description="Oturum, güvenlik, temel işlevler (kapatılamaz)"
                num="I"
                enabled
                locked
              />
              <PrefRow
                label="İşlevsel Çerezler"
                description="Dil tercihi, tema ayarları"
                num="II"
                enabled={prefs.functional}
                onToggle={() => setPrefs(p => ({ ...p, functional: !p.functional }))}
              />
              <PrefRow
                label="İstatistik Çerezleri"
                description="Anonim kullanım istatistikleri"
                num="III"
                enabled={prefs.analytics}
                onToggle={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
              />
            </div>
          )}
        </div>

        {/* Footer — action buttons */}
        <div
          className="px-5 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          style={{ background: CREAM, borderTop: `1px solid ${RULE}` }}
        >
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="ck-mono inline-flex items-center justify-center gap-1.5 px-4 text-[11px] tracking-[0.22em] transition-colors"
            style={{
              height: 40,
              color: INK,
              background: 'transparent',
              border: `1px solid ${RULE}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Settings className="h-3.5 w-3.5" />
            {showSettings ? 'GİZLE' : 'AYARLAR'}
          </button>

          {showSettings ? (
            <button
              type="button"
              onClick={acceptSelected}
              className="group ck-mono flex-1 inline-flex items-center justify-center gap-2 px-5 text-[11px] tracking-[0.26em] transition-colors"
              style={{
                height: 40,
                color: CREAM,
                background: INK,
                border: `1px solid ${INK}`,
                boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 3px #fff, 0 0 0 4px #10b98155`,
              }}
            >
              <Check className="h-3.5 w-3.5" style={{ color: GOLD }} />
              SEÇİLENLERİ KABUL ET
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={rejectOptional}
                className="ck-mono flex-1 inline-flex items-center justify-center px-4 text-[11px] tracking-[0.22em] transition-colors"
                style={{
                  height: 40,
                  color: INK_SOFT,
                  background: 'transparent',
                  border: `1px solid ${RULE}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = INK; e.currentTarget.style.background = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = INK_SOFT; e.currentTarget.style.background = 'transparent'; }}
              >
                SADECE ZORUNLU
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="group ck-mono flex-1 inline-flex items-center justify-center gap-2 px-5 text-[11px] tracking-[0.26em] transition-colors"
                style={{
                  height: 40,
                  color: CREAM,
                  background: INK,
                  border: `1px solid ${INK}`,
                  boxShadow: `0 0 0 1px ${GOLD}, 0 0 0 3px #fff, 0 0 0 4px #10b98155`,
                }}
              >
                <span>TÜMÜNÜ KABUL ET</span>
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  style={{ color: GOLD }}
                />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PrefRow({
  label,
  description,
  num,
  enabled,
  locked = false,
  onToggle,
}: {
  label: string
  description: string
  num: string
  enabled: boolean
  locked?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] gap-3 items-center">
      <span
        className="ck-display text-base"
        style={{ color: GOLD, fontStyle: 'italic', fontWeight: 500, lineHeight: 1 }}
      >
        {num}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-tight" style={{ color: INK }}>
          {label}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: INK_SOFT }}>
          {description}
        </p>
      </div>
      {locked ? (
        <span
          className="ck-mono text-[9px] tracking-[0.22em] px-2 py-1"
          style={{
            color: GOLD,
            background: 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${GOLD}`,
            borderRadius: '2px',
            fontWeight: 700,
          }}
        >
          AKTİF
        </span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          className="relative inline-flex items-center transition-colors"
          style={{
            width: 40,
            height: 22,
            background: enabled ? INK : RULE,
            borderRadius: '2px',
            border: enabled ? `1px solid ${INK}` : `1px solid ${RULE}`,
          }}
        >
          <span
            className="inline-block transition-transform"
            style={{
              width: 16,
              height: 16,
              background: enabled ? GOLD : '#ffffff',
              borderRadius: '1px',
              transform: enabled ? 'translateX(22px)' : 'translateX(2px)',
              boxShadow: enabled ? 'none' : '0 1px 2px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      )}
    </div>
  )
}
