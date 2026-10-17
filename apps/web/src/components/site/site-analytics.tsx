'use client'

import { Suspense, useSyncExternalStore } from 'react'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'
import { CONSENT_CHANGE_EVENT, readConsentPrefs } from '@/lib/cookie-consent'

/** Yalnız kampanya parametreleri tutulur; diğer sorgu parametreleri (olası kişisel veri) atılır. */
function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  const kept = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    if (key.startsWith('utm_')) kept.set(key, value)
  })
  url.search = kept.toString()
  return { ...event, url: url.toString() }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
}

/**
 * Çerezsiz, birinci taraf analitik (Vercel Web Analytics, aynı alan adından).
 * Yalnız çerez bandında "Analitik" tercihi açıksa yüklenir; tercih değişince anında uyar.
 * On-prem kurulumda SiteShell bu bileşeni hiç render etmez.
 */
export function SiteAnalytics() {
  const allowed = useSyncExternalStore(subscribe, () => readConsentPrefs().analytics, () => false)

  if (!allowed) return null
  return (
    <Suspense fallback={null}>
      <Analytics beforeSend={stripQuery} />
    </Suspense>
  )
}
