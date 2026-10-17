'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CONSENT_OPEN_EVENT,
  ESSENTIAL_ONLY,
  hasStoredConsent,
  readConsentPrefs,
  saveConsentPrefs,
  type CookiePreferences,
} from '@/lib/cookie-consent'
import './cookie-consent.css'

/** İlk boyamayı (LCP) bekletmemek için banner kısa bir gecikmeyle gelir. */
const SHOW_DELAY_MS = 1000

const ROWS: ReadonlyArray<{ key: keyof Omit<CookiePreferences, 'essential'>; label: string; desc: string }> = [
  { key: 'functional', label: 'İşlevsel', desc: 'Dil ve tema gibi tercihlerinizin hatırlanması.' },
  { key: 'analytics', label: 'İstatistik', desc: 'Anonim sayfa görüntüleme sayımı. Çerez kullanmaz.' },
]

/**
 * Çerez onay banner'ı (tüm site + paneller). Kabul ve ret eşit ağırlıkta sunulur;
 * "İstatistik" tercihi SiteAnalytics'i gerçekten açar/kapatır (lib/cookie-consent).
 * Alt bilgideki "Çerez tercihleri" düğmesi banner'ı ayarlar açık hâlde yeniden açar.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // Banner ilk boyamada görünmez (visible=false), bu yüzden tembel okuma hidrasyon farkı üretmez.
  const [prefs, setPrefs] = useState<CookiePreferences>(() =>
    typeof window === 'undefined' ? ESSENTIAL_ONLY : readConsentPrefs(),
  )
  const titleId = useId()
  const panelId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOpen = () => {
      setPrefs(readConsentPrefs())
      setShowSettings(true)
      setVisible(true)
      requestAnimationFrame(() => dialogRef.current?.focus())
    }
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)

    const timer = hasStoredConsent() ? undefined : setTimeout(() => setVisible(true), SHOW_DELAY_MS)

    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const commit = useCallback((next: CookiePreferences) => {
    saveConsentPrefs(next)
    setPrefs(next)
    setVisible(false)
    setShowSettings(false)
  }, [])

  if (!visible) return null

  return (
    <div
      ref={dialogRef}
      className="ck-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <h2 id={titleId} className="ck-title">Çerez tercihleriniz</h2>
      <p className="ck-text">
        Platformun çalışması için zorunlu çerezler kullanılır. İşlevsel tercihler ve anonim istatistik
        yalnız izin verirseniz açılır. Ayrıntılar için{' '}
        <Link href="/cerez-politikasi">Çerez Politikası</Link>.
      </p>

      {showSettings && (
        <ul id={panelId} className="ck-prefs">
          <li className="ck-pref">
            <div>
              <p className="ck-pref-label">Zorunlu</p>
              <p className="ck-pref-desc">Oturum, güvenlik ve temel işlevler. Kapatılamaz.</p>
            </div>
            <span className="ck-badge">Her zaman açık</span>
          </li>
          {ROWS.map((row) => (
            <li key={row.key} className="ck-pref">
              <div>
                <p className="ck-pref-label" id={`${panelId}-${row.key}`}>{row.label}</p>
                <p className="ck-pref-desc">{row.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[row.key]}
                aria-labelledby={`${panelId}-${row.key}`}
                className="ck-switch"
                onClick={() => setPrefs((p) => ({ ...p, [row.key]: !p[row.key] }))}
              >
                <span className="ck-switch-thumb" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="ck-actions">
        {showSettings ? (
          <button type="button" className="ck-btn ck-btn-primary" onClick={() => commit(prefs)}>
            Seçimimi kaydet
          </button>
        ) : (
          <>
            <button type="button" className="ck-btn ck-btn-ghost" onClick={() => commit(ESSENTIAL_ONLY)}>
              Yalnız zorunlu
            </button>
            <button
              type="button"
              className="ck-btn ck-btn-primary"
              onClick={() => commit({ essential: true, functional: true, analytics: true })}
            >
              Tümünü kabul et
            </button>
          </>
        )}
        <button
          type="button"
          className="ck-link"
          aria-expanded={showSettings}
          aria-controls={showSettings ? panelId : undefined}
          onClick={() => setShowSettings((v) => !v)}
        >
          {showSettings ? 'Ayarları gizle' : 'Ayarlar'}
        </button>
      </div>
    </div>
  )
}
